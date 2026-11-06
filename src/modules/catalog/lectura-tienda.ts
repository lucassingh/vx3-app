import "server-only";
import { getDb } from "@/db/client";
import type { CategoriaDeLaTienda, ProductoDeLaTienda } from "@/integrations/tiendanube/client";
import { Money } from "@/lib/money";
import { seccionDeLaCategoria, SECCIONES_DE_LA_TIENDA } from "./tienda";

/** Una foto de la tienda: para el control final y la verificación por conjuntos (`VX3_Hub_subida…` §6). */

const aCentavos = (precio: string | null | undefined) => {
  const numero = Number(precio ?? 0);
  return Number.isFinite(numero) ? Money.fromPesos(numero).cents : 0n;
};

export type ResumenDeLaTienda = {
  productos: number;
  visibles: number;
  fueraDeLasSecciones: number;
  porSeccion: Record<string, number>;
};

/**
 * La suma por sección es por conjuntos, como la verificación del Hub: un producto que no cuelga de
 * ninguna de las 7 secciones no aparece en ningún menú de la tienda, aunque esté publicado.
 */
export function resumirLaTienda(
  productos: readonly ProductoDeLaTienda[],
  categorias: readonly CategoriaDeLaTienda[],
): { filas: ReturnType<typeof aFilaBase>[]; resumen: ResumenDeLaTienda } {
  const mapa = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  const filas = productos.map((producto) => {
    const secciones = new Set(
      producto.categories.flatMap(({ id }) => {
        const seccion = seccionDeLaCategoria(id, mapa);
        return seccion ? [seccion] : [];
      }),
    );
    return aFilaBase(producto, [...secciones][0] ?? null);
  });

  const porSeccion = Object.fromEntries(
    SECCIONES_DE_LA_TIENDA.map((seccion) => [seccion, filas.filter((fila) => fila.section === seccion).length]),
  );
  return {
    filas,
    resumen: {
      productos: filas.length,
      visibles: filas.filter(({ published }) => published).length,
      fueraDeLasSecciones: filas.filter(({ section }) => section === null).length,
      porSeccion,
    },
  };
}

function aFilaBase(producto: ProductoDeLaTienda, section: string | null) {
  const variante = producto.variants[0];
  return {
    id: BigInt(producto.id),
    sku: variante?.sku?.trim() || null,
    name: Object.values(producto.name ?? {}).find(Boolean) ?? "",
    published: producto.published,
    section,
    categoryIds: producto.categories.map(({ id }) => id),
    imageCount: producto.images.length,
    priceCents: aCentavos(variante?.price),
  };
}

/** Se reemplaza entera: es una foto, y lo que ya no está en la tienda deja de contar. */
export async function guardarLecturaDeLaTienda(
  productos: readonly ProductoDeLaTienda[],
  categorias: readonly CategoriaDeLaTienda[],
  ahora: Date,
): Promise<ResumenDeLaTienda> {
  const { filas, resumen } = resumirLaTienda(productos, categorias);
  await getDb().$transaction(async (tx) => {
    await tx.storeProduct.deleteMany();
    await tx.storeProduct.createMany({ data: filas.map((fila) => ({ ...fila, readAt: ahora })) });
  });
  return resumen;
}
