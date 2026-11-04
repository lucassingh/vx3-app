import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { leerCodigo } from "@/modules/catalog/codigos";
import type { ErpItem } from "./erp-gateway";

/**
 * Espejo de productos, stock y precios (RF-M2-01). Guarda lo que dice el ERP, sin
 * corregirlo. Se puede repetir sin efectos: una fila solo cambia si cambió lo leído.
 *
 * Todo lo de una corrida se marca con su misma hora de inicio. Así, lo que no se vio
 * es lo que quedó con una hora anterior, sin depender de los relojes de cada instancia.
 */

function aFila(item: ErpItem) {
  const { tipo, base, normalizado, cantidad, fueraDeRegla } = leerCodigo(item.codigo, item.rubro);
  return {
    code: item.codigo,
    normalizedCode: normalizado,
    kind: tipo,
    baseCode: base,
    packQuantity: cantidad,
    outOfRule: fueraDeRegla,
    name: item.nombre,
    category: item.rubro,
    subcategory: item.subrubro,
    brand: item.marca,
    supplierId: item.proveedorId,
    supplier: item.proveedor,
    costCents: BigInt(item.costoCentavos),
    prices: item.precios.map(({ listaId, lista, centavos }) => ({ listId: listaId, list: lista, cents: centavos })),
    // Como texto: Number no llega a representar exacto lo que la columna guarda.
    stockReal: item.stockReal.toFixed(8),
    stockReserved: item.stockReservado.toFixed(8),
    stockAvailable: item.stockDisponible.toFixed(8),
    enabled: item.habilitado,
    externalCode: item.codigoExterno,
    imageUrl: item.imagenUrl,
    createdOn: new Date(`${item.creadoEl}T00:00:00Z`),
  };
}

function huella(item: ErpItem): string {
  return createHash("sha256").update(JSON.stringify(item)).digest("hex");
}

export type ResultadoDePagina = { nuevos: number; cambiados: number; sinCambios: number };

export async function guardarItems(items: ErpItem[], inicioDeCorrida: Date): Promise<ResultadoDePagina> {
  const db = getDb();
  const porCodigo = new Map(items.map((item) => [item.codigo, item]));
  const existentes = await db.duxItem.findMany({
    where: { code: { in: [...porCodigo.keys()] } },
    select: { code: true, contentHash: true, present: true },
  });
  const previos = new Map(existentes.map((fila) => [fila.code, fila]));

  const nuevos: ErpItem[] = [];
  const cambiados: ErpItem[] = [];
  const sinCambios: string[] = [];
  for (const item of porCodigo.values()) {
    const previo = previos.get(item.codigo);
    if (!previo) nuevos.push(item);
    // Si había dejado de aparecer y volvió, también es un cambio.
    else if (previo.contentHash !== huella(item) || !previo.present) cambiados.push(item);
    else sinCambios.push(item.codigo);
  }

  await db.$transaction([
    db.duxItem.createMany({
      data: nuevos.map((item) => ({
        id: newId(),
        ...aFila(item),
        contentHash: huella(item),
        firstSeenAt: inicioDeCorrida,
        lastSeenAt: inicioDeCorrida,
        changedAt: inicioDeCorrida,
      })),
    }),
    ...cambiados.map((item) =>
      db.duxItem.update({
        where: { code: item.codigo },
        data: {
          ...aFila(item),
          contentHash: huella(item),
          present: true,
          lastSeenAt: inicioDeCorrida,
          changedAt: inicioDeCorrida,
        },
      }),
    ),
    db.duxItem.updateMany({ where: { code: { in: sinCambios } }, data: { lastSeenAt: inicioDeCorrida } }),
  ]);

  return { nuevos: nuevos.length, cambiados: cambiados.length, sinCambios: sinCambios.length };
}

/**
 * Lo que esta corrida no vio ya no está en el ERP. No se borra: las ventas viejas se
 * leen contra esos códigos. Solo se llama si se leyeron todas las páginas.
 */
export async function marcarAusentes(inicioDeCorrida: Date): Promise<number> {
  const { count } = await getDb().duxItem.updateMany({
    where: { present: true, lastSeenAt: { lt: inicioDeCorrida } },
    data: { present: false, changedAt: inicioDeCorrida },
  });
  return count;
}
