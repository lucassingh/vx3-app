import "server-only";
import { getDb } from "@/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { mediaUrl } from "@/integrations/blob";
import { tiendaNube, tiendaNubeEscritura } from "@/integrations/tiendanube";
import type {
  CatalogoAltaInput,
  CatalogoBorrador,
  CatalogoEstadoEnLaTienda,
  CatalogoPedidoDeLaTienda,
} from "@/lib/api/contracts/catalogo";
import { ConflictError, isAppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { soltarBloqueo, tomarBloqueo } from "@/modules/platform/sync-runs";
import { aBorrador } from "./alta-consultas";
import { bultoDe, categoriaDeLaRuta, pedidoDeProducto, rutaDeCategoria } from "./tienda";

/**
 * Publicar en Tienda Nube, de a un paso, como en DUX: primero el producto, oculto; después cada
 * foto. Se muestra aparte, cuando DUX ya le puso el precio (RN-101). El cruce es por SKU: solo se
 * crea lo que no está, así que retomar no duplica. Fuera de producción no se escribe nada.
 */

const VENCE_EL_PASO_MS = 2 * 60 * 1000;
const bloqueoDe = (id: string) => `tienda:${id}`;

const leerBorrador = async (id: string) => {
  const borrador = await getDb().catalogDraft.findUnique({ where: { id } });
  if (!borrador) throw new NotFoundError("Ese borrador ya no está.");
  return borrador;
};

const estadoDe = (valor: Prisma.JsonValue | null): CatalogoEstadoEnLaTienda =>
  (valor as CatalogoEstadoEnLaTienda | null) ?? {
    productoId: null,
    fotos: 0,
    visible: false,
    detalle: null,
    error: false,
  };

const guardar = (id: string, estado: CatalogoEstadoEnLaTienda) =>
  getDb().catalogDraft.update({
    where: { id },
    data: {
      storeState: estado as unknown as Prisma.InputJsonObject,
      storeDoneAt: estado.visible ? new Date() : null,
      updatedAt: new Date(),
    },
  });

const conCandado = async <T>(id: string, hacer: () => Promise<T>): Promise<T> => {
  const candado = await tomarBloqueo(bloqueoDe(id), VENCE_EL_PASO_MS);
  if (!candado) throw new ConflictError("Este producto ya se está publicando.");
  try {
    return await hacer();
  } finally {
    await soltarBloqueo(bloqueoDe(id), candado);
  }
};

export type AvanceEnLaTienda = {
  borrador: CatalogoBorrador;
  /** Lo que se hizo en este paso, para dejarlo en la auditoría. */
  hecho: { accion: "producto" | "foto"; sku: string; productoId: number } | null;
};

/** Hace un paso. Lo que Tienda Nube rechaza queda en el estado, y el botón lo retoma. */
export function avanzarEnLaTienda(id: string): Promise<AvanceEnLaTienda> {
  return conCandado(id, async () => {
    const fila = await leerBorrador(id);
    if (!fila.duxDoneAt) throw new ConflictError("Primero tiene que estar en DUX: el precio y el stock salen de ahí.");
    const escritura = await tiendaNubeEscritura();
    const lectura = await tiendaNube();

    const input = fila.data as unknown as CatalogoAltaInput;
    const { codigo: sku } = bultoDe(input);
    const estado = estadoDe(fila.storeState);
    estado.error = false;
    estado.detalle = null;
    let hecho: AvanceEnLaTienda["hecho"] = null;

    try {
      if (estado.productoId === null) {
        const existente = await lectura.buscarPorSku(sku);
        if (existente) {
          estado.productoId = existente.id;
          estado.fotos = Math.min(existente.images.length, input.fotos.length);
          estado.detalle = "Ya estaba en la tienda: no se creó de nuevo.";
        } else {
          const ruta = rutaDeCategoria(input.rubro, input.subrubro);
          if (!ruta) {
            throw new ConflictError(
              `${input.rubro} no tiene regla de categoría: VX3 decide en qué sección va (RN-102).`,
            );
          }
          const categoria = categoriaDeLaRuta(ruta, await lectura.listarCategorias());
          if ("falta" in categoria) throw new ConflictError(categoria.falta);
          const creado = await escritura.crearProducto(pedidoDeProducto(input, categoria.id));
          estado.productoId = creado.id;
          hecho = { accion: "producto", sku, productoId: creado.id };
        }
      } else if (estado.fotos < input.fotos.length) {
        const posicion = estado.fotos;
        // Un corte justo después de subirla no la duplica: se mira cuántas tiene antes.
        const { images } = await lectura.producto(estado.productoId);
        if (images.length <= posicion) {
          const src = mediaUrl(input.fotos[posicion]!.clave);
          if (!src) throw new ConflictError("Este ambiente no tiene dónde guardar fotos.");
          await escritura.agregarFoto(estado.productoId, { src, position: posicion + 1 });
          hecho = { accion: "foto", sku, productoId: estado.productoId };
        }
        estado.fotos = posicion + 1;
      }
    } catch (error) {
      if (!isAppError(error)) throw error;
      logger.warn({ sku, code: error.code }, "alta en Tienda Nube: falló un paso");
      estado.error = true;
      estado.detalle = error.message;
    }

    return { borrador: aBorrador(await guardar(id, estado)), hecho };
  });
}

/** Lo último, y aparte: nunca se muestra a $ 0 (RN-101) ni sin foto (RN-09). */
export function mostrarEnLaTienda(id: string): Promise<CatalogoBorrador> {
  return conCandado(id, async () => {
    const fila = await leerBorrador(id);
    const estado = estadoDe(fila.storeState);
    if (estado.productoId === null) throw new ConflictError("Todavía no está en la tienda.");
    const escritura = await tiendaNubeEscritura();

    const producto = await (await tiendaNube()).producto(estado.productoId);
    if (!(Number(producto.variants[0]?.price ?? 0) > 0)) {
      throw new ConflictError(
        "DUX todavía no le puso el precio. Se completa solo a los pocos minutos: probá de nuevo en un rato.",
      );
    }
    if (producto.images.length === 0) throw new ConflictError("Sin foto no se publica en la tienda (RN-09).");

    await escritura.mostrarProducto(estado.productoId);
    return aBorrador(await guardar(id, { ...estado, visible: true, error: false, detalle: null }));
  });
}

/** Lo que se mandaría, sin mandarlo. Es lo único que se puede hacer fuera de producción. */
export async function pedidoDeLaTienda(id: string): Promise<CatalogoPedidoDeLaTienda> {
  const { data } = await leerBorrador(id);
  const input = data as unknown as CatalogoAltaInput;
  const ruta = rutaDeCategoria(input.rubro, input.subrubro);
  const fotos = input.fotos.flatMap(({ clave }) => mediaUrl(clave) ?? []);

  if (!ruta) {
    return {
      ruta: null,
      categoriaId: null,
      problema: `${input.rubro} no tiene regla de categoría: VX3 decide en qué sección va (RN-102).`,
      pedido: pedidoDeProducto(input, 0),
      fotos,
    };
  }
  try {
    const categoria = categoriaDeLaRuta(ruta, await (await tiendaNube()).listarCategorias());
    if ("falta" in categoria) {
      return { ruta, categoriaId: null, problema: categoria.falta, pedido: pedidoDeProducto(input, 0), fotos };
    }
    return { ruta, categoriaId: categoria.id, problema: null, pedido: pedidoDeProducto(input, categoria.id), fotos };
  } catch (error) {
    if (!isAppError(error)) throw error;
    // Sin la tienda a mano igual se ve casi todo: lo único que falta es el ID de la categoría.
    return { ruta, categoriaId: null, problema: error.message, pedido: pedidoDeProducto(input, 0), fotos };
  }
}
