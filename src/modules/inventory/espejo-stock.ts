import "server-only";
import { getDb } from "@/db/client";
import { MAXIMO_FILAS_ESPEJO, type StockQuery, type StockSync } from "@/lib/api/contracts/stock";
import type { Kpi, StockFila } from "@/lib/api/types";
import { businessTime } from "@/lib/dates";
import { normalizeText } from "@/lib/utils";
import { estaAlDia, frecuenciaDeDux } from "@/modules/platform/integraciones/estado";
import { filaDeProducto, kpisDeStock, ordenarPorAtencion } from "./stock";

/**
 * Lo que muestra Stock → Espejo, leído de Postgres con el mismo contrato de la maqueta.
 * Son unos 2.500 códigos: se arman las filas en memoria, una por producto.
 */

const DIA_MS = 86_400_000;

async function leerFilas(): Promise<{ filas: StockFila[]; codigos: number }> {
  const db = getDb();
  const desde = new Date(`${businessTime.addDays(businessTime.today(), -30)}T00:00:00Z`);
  const [items, ventas] = await Promise.all([
    db.duxItem.findMany({
      where: { present: true, kind: { in: ["prenda", "pack", "combo"] } },
      select: {
        code: true,
        kind: true,
        baseCode: true,
        packQuantity: true,
        name: true,
        category: true,
        stockReal: true,
        stockReserved: true,
        stockAvailable: true,
      },
    }),
    // Por producto y en prendas: cruza el corte del 10/10, con todas las presentaciones (VENTA_VALIDA).
    db.$queryRaw<{ base: string; prendas: number }[]>`
      SELECT i.base_code AS base, SUM(i.quantity * COALESCE(i.pack_quantity, 1))::float8 AS prendas
      FROM dux_invoice_items i
      JOIN dux_invoices f ON f.id = i.invoice_id
      WHERE f.cancelled = false AND f.type NOT LIKE '%NOTA_CREDITO%' AND f.issued_on >= ${desde}
        AND i.kind <> 'no_producto'
      GROUP BY i.base_code`,
  ]);

  const vendidas = new Map(ventas.map(({ base, prendas }) => [base, prendas]));
  const packs = new Map<string, number[]>();
  for (const { kind, baseCode, packQuantity } of items) {
    if (kind === "pack" && packQuantity) packs.set(baseCode, [...(packs.get(baseCode) ?? []), packQuantity]);
  }

  const filas = items
    .filter(({ kind }) => kind !== "pack")
    .map((item) =>
      filaDeProducto({
        sku: item.code,
        nombre: item.name,
        rubro: item.category ?? (item.kind === "combo" ? "COMBOS" : "Sin rubro"),
        esCombo: item.kind === "combo",
        packs: packs.get(item.baseCode) ?? [],
        real: Number(item.stockReal),
        reservado: Number(item.stockReserved),
        disponible: Number(item.stockAvailable),
        ventasPrendas: vendidas.get(item.baseCode) ?? 0,
      }),
    );
  return { filas: ordenarPorAtencion(filas), codigos: items.length };
}

export async function filasDelEspejo(): Promise<StockFila[]> {
  return (await leerFilas()).filas;
}

export async function espejoDeStock({ q, rubro, estado }: StockQuery = {}): Promise<StockFila[]> {
  const { filas } = await leerFilas();
  const buscado = normalizeText(q?.trim() ?? "");
  return filas
    .filter((fila) => !buscado || normalizeText(`${fila.sku} ${fila.nombre}`).includes(buscado))
    .filter((fila) => !rubro || fila.rubro === rubro)
    .filter((fila) => !estado || fila.estado === estado)
    .slice(0, MAXIMO_FILAS_ESPEJO);
}

export async function kpisDelEspejo(): Promise<Kpi[]> {
  const { filas, codigos } = await leerFilas();
  return kpisDeStock(filas, codigos);
}

export async function rubrosDelEspejo(): Promise<string[]> {
  const { filas } = await leerFilas();
  return [...new Set(filas.map(({ rubro }) => rubro))].toSorted((a, b) => a.localeCompare(b, "es"));
}

export async function estadoDelEspejo(): Promise<StockSync> {
  const db = getDb();
  const lectura = { integration: "dux", operation: "items" };
  const ahora = new Date();
  const [ultima, errores24h] = await Promise.all([
    db.syncRun.findFirst({
      where: { ...lectura, status: { in: ["ok", "con_errores"] } },
      orderBy: { startedAt: "desc" },
    }),
    db.syncRun.count({
      where: {
        ...lectura,
        status: { in: ["error", "con_errores"] },
        startedAt: { gte: new Date(ahora.getTime() - DIA_MS) },
      },
    }),
  ]);
  const terminada = ultima?.finishedAt ?? null;

  return {
    ultimaLectura: terminada?.toISOString() ?? null,
    frecuencia: frecuenciaDeDux(),
    alDia: ultima?.status === "ok" && estaAlDia(terminada, ahora),
    llamadas: ultima?.calls ?? 0,
    codigos: ultima?.records ?? 0,
    duracionS: ultima && terminada ? (terminada.getTime() - ultima.startedAt.getTime()) / 1000 : 0,
    errores24h,
  };
}
