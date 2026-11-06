import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { Prisma } from "@/generated/prisma/client";
import { mediaUrl } from "@/integrations/blob";
import { tiendaNube, tiendaNubeEscritura } from "@/integrations/tiendanube";
import type { CatalogoAltaInput, CatalogoEdicion, FotoSubida } from "@/lib/api/contracts/catalogo";
import { ConflictError, isAppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { soltarBloqueo, tomarBloqueo } from "@/modules/platform/sync-runs";
import { borrarFotosSinUso, escrituraEnLaTienda, opcionesDeAlta } from "./alta-consultas";
import { normalizarCodigo } from "./codigos";
import { estadoDelCorte } from "./corte";
import {
  celdasDeLaFicha,
  FILA_DE_LA_APP,
  filaDelAlta,
  fotosQuitadas,
  unirFotos,
  type DatosDeLaFicha,
  type FotoDeLaFila,
} from "./fila-de-la-app";
import { armarDesdeLasCopias, BLOQUEO_DEL_CATALOGO } from "./importar";
import { descripcionDeLaTienda } from "./tienda";

/**
 * Cargar y editar en la app (`06` §6.2). El nombre, el rubro, la marca, el costo y el precio se
 * siguen cambiando donde se cambian hoy (decisión 5 de la 1.9): acá va la ficha y las fotos.
 */

const VENCE_EL_ARMADO_MS = 5 * 60 * 1000;

const proximaFila = async (tx: Pick<Prisma.TransactionClient, "catalogSheetRow">) => {
  const { _max } = await tx.catalogSheetRow.aggregate({ _max: { rowNumber: true } });
  return Math.max(_max.rowNumber ?? 0, FILA_DE_LA_APP) + 1;
};

const buscarFilaDeLaApp = (sku: string) =>
  getDb().catalogSheetRow.findFirst({ where: { source: "app", shown: { path: ["SKU"], equals: sku } } });

/** Cuando el producto ya está en DUX. Si se repite, no duplica: el retomar llega acá de nuevo. */
export async function agregarAlCatalogo(input: CatalogoAltaInput, ahora = new Date()): Promise<void> {
  if (await buscarFilaDeLaApp(input.sku)) return;
  const db = getDb();
  const proveedor = await db.duxReference.findFirst({
    where: { kind: "proveedor", duxId: Number(input.proveedorId) },
    select: { name: true },
  });
  const { shown, raw, appPhotos } = filaDelAlta(input, proveedor?.name ?? "");
  await db.catalogSheetRow.create({
    data: {
      id: newId(),
      rowNumber: await proximaFila(db),
      source: "app",
      shown,
      raw: raw as Prisma.InputJsonObject,
      appPhotos: appPhotos as unknown as Prisma.InputJsonArray,
      readAt: ahora,
    },
  });
}

async function filaDelProducto(sku: string, sheetRow: number | null) {
  const db = getDb();
  if (sheetRow) return db.catalogSheetRow.findUnique({ where: { rowNumber: sheetRow } });
  return buscarFilaDeLaApp(sku);
}

/** Lo que muestra la pantalla de edición. */
export async function datosDeLaEdicion(sku: string): Promise<CatalogoEdicion | null> {
  const db = getDb();
  const producto = await db.catalogProduct.findFirst({
    where: { baseCode: normalizarCodigo(sku), present: true },
    include: { photos: { select: { driveId: true }, where: { driveId: { not: null } } } },
  });
  if (!producto) return null;

  const [fila, corte, { atributos }] = await Promise.all([
    filaDelProducto(producto.baseCode, producto.sheetRow),
    estadoDelCorte(),
    opcionesDeAlta(),
  ]);
  return {
    sku: producto.baseCode,
    nombre: producto.name,
    tela: producto.fabric ?? "",
    colores: producto.colors ?? "",
    talles: producto.sizes ?? "",
    atributos: producto.attributes as Record<string, string>,
    pesoKg: producto.weightKg ? Number(producto.weightKg) : 0,
    medidasCm: [producto.lengthCm ?? 0, producto.widthCm ?? 0, producto.heightCm ?? 0].map(Number) as [
      number,
      number,
      number,
    ],
    fotosDeDrive: producto.photos.length,
    fotos: ((fila?.appPhotos as FotoDeLaFila[] | null) ?? []).map(({ clave, nombre, ancho, alto }) => ({
      clave,
      nombre,
      ancho,
      alto,
    })),
    opcionesDeAtributos: atributos,
    cortado: corte !== null,
  };
}

/** La tienda, por SKU (decisión 6). Lo guardado en la app no se pierde si esto falla: se dice y se reintenta guardando. */
async function actualizarLaTienda(
  input: CatalogoAltaInput,
  bulto: string,
  { pesoKg, medidasCm }: DatosDeLaFicha,
  fotos: FotoDeLaFila[],
): Promise<{ fotos: FotoDeLaFila[]; aviso: string | null }> {
  const { puede, motivo } = escrituraEnLaTienda();
  if (!puede) return { fotos, aviso: motivo };
  const actualizadas = fotos.map((foto) => ({ ...foto }));
  try {
    const lectura = await tiendaNube();
    const producto = await lectura.buscarPorSku(bulto);
    if (!producto) return { fotos, aviso: `${bulto} no está en la tienda: no había nada que actualizar.` };
    const escritura = await tiendaNubeEscritura();
    await escritura.actualizarDescripcion(producto.id, descripcionDeLaTienda(input));
    const variante = producto.variants[0]?.id;
    const [largo, ancho, alto] = medidasCm;
    if (variante) {
      await escritura.actualizarVariante(producto.id, variante, {
        weight: pesoKg,
        width: ancho,
        height: alto,
        depth: largo,
      });
    }
    let posicion = producto.images.length;
    for (const foto of actualizadas) {
      if (foto.enTienda) continue;
      const src = mediaUrl(foto.clave);
      if (!src) continue;
      posicion += 1;
      await escritura.agregarFoto(producto.id, { src, position: posicion });
      foto.enTienda = true;
    }
    return { fotos: actualizadas, aviso: null };
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ bulto, code: error.code }, "edición: no se pudo actualizar la tienda");
    return { fotos: actualizadas, aviso: `En la app quedó guardado, pero la tienda no: ${error.message}` };
  }
}

export type CambiosDeLaFicha = DatosDeLaFicha & { fotos: FotoSubida[] };

export async function editarProducto(
  sku: string,
  cambios: CambiosDeLaFicha,
): Promise<{ aviso: string | null; codigo: string }> {
  if (!(await estadoDelCorte())) {
    throw new ConflictError("Antes del corte, el producto se edita en el Sheet: acá se pisaría con cada importación.");
  }
  const db = getDb();
  const producto = await db.catalogProduct.findFirst({ where: { baseCode: normalizarCodigo(sku), present: true } });
  if (!producto) throw new NotFoundError("Ese producto ya no está.");

  const candado = await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_EL_ARMADO_MS);
  if (!candado) throw new ConflictError("Se está armando el catálogo: probá de nuevo en un momento.");
  try {
    const fila = await filaDelProducto(producto.baseCode, producto.sheetRow);
    const antes = (fila?.appPhotos as FotoDeLaFila[] | null) ?? [];
    const unidas = unirFotos(antes, cambios.fotos);
    const { shown, raw } = celdasDeLaFicha(cambios);
    const ahora = new Date();

    // Un producto que estaba solo en DUX estrena su ficha.
    const filaId =
      fila?.id ??
      (
        await db.catalogSheetRow.create({
          data: {
            id: newId(),
            rowNumber: await proximaFila(db),
            source: "app",
            shown: { SKU: producto.baseCode },
            raw: { SKU: producto.baseCode },
            readAt: ahora,
          },
        })
      ).id;
    const previa = await db.catalogSheetRow.findUniqueOrThrow({ where: { id: filaId } });
    const guardar = (fotos: FotoDeLaFila[]) =>
      db.catalogSheetRow.update({
        where: { id: filaId },
        data: { appPhotos: fotos as unknown as Prisma.InputJsonArray },
      });

    await db.catalogSheetRow.update({
      where: { id: filaId },
      data: {
        shown: { ...(previa.shown as object), ...shown },
        raw: { ...(previa.raw as object), ...raw } as Prisma.InputJsonObject,
      },
    });
    await guardar(unidas);
    await armarDesdeLasCopias(ahora);
    await borrarFotosSinUso(fotosQuitadas(antes, unidas));

    const { fotos, aviso } = producto.bulkCode
      ? await actualizarLaTienda(aFichaParaLaTienda(producto, cambios), producto.bulkCode, cambios, unidas)
      : { fotos: unidas, aviso: "No tiene bulto: no había nada que actualizar en la tienda." };
    await guardar(fotos);
    return { aviso, codigo: producto.baseCode };
  } finally {
    await soltarBloqueo(BLOQUEO_DEL_CATALOGO, candado);
  }
}

/** La descripción se arma igual que en el alta. */
function aFichaParaLaTienda(
  producto: {
    baseCode: string;
    name: string;
    category: string | null;
    subcategory: string | null;
    brand: string | null;
  },
  { tela, colores, talles, atributos, pesoKg, medidasCm, fotos }: CambiosDeLaFicha,
): CatalogoAltaInput {
  const { copa = "", ...resto } = atributos;
  return {
    sku: producto.baseCode,
    rubro: producto.category ?? "",
    subrubro: producto.subcategory ?? "",
    nombre: producto.name,
    prenda: producto.name,
    color: "",
    copa,
    marca: producto.brand ?? "",
    proveedorId: "",
    tela,
    colores: [colores],
    talles,
    atributos: resto,
    opcionales: {},
    costoDocena: 0,
    pesoBultoKg: pesoKg,
    medidasCm,
    fotos,
  };
}
