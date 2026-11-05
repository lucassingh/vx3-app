import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { Segmento } from "@/lib/api/types";
import { businessTime } from "@/lib/dates";
import { VENTA_VALIDA } from "@/modules/inventory/ventas";
import { unirFichas, type ClientaUnida } from "./ficha-unica";
import { calcularMetricas, elegirSegmento, umbralTop, type ComprobanteDeClienta } from "./metricas";

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00Z`);
const huella = (dato: unknown) => createHash("sha256").update(JSON.stringify(dato)).digest("hex");

/** Las filas con el nombre de sus columnas, para jsonb_to_recordset. */
function aJson(filas: FilaDeClienta[]): string {
  return JSON.stringify(
    filas.map((fila) => ({
      normalized_phone: fila.normalizedPhone,
      name: fila.name,
      first_name: fila.firstName,
      phone: fila.phone,
      email: fila.email,
      province: fila.province,
      city: fila.city,
      dux_records: fila.duxRecords,
      purchases: fila.purchases,
      total_cents: String(fila.totalCents),
      margin_cents: String(fila.marginCents),
      margin_12m_cents: String(fila.margin12mCents),
      first_purchase_on: fila.firstPurchaseOn,
      last_purchase_on: fila.lastPurchaseOn,
      cycle_days: fila.cycleDays,
      segment: fila.segment,
      content_hash: fila.contentHash,
    })),
  );
}

type FilaDeClienta = ClientaUnida & {
  purchases: number;
  totalCents: bigint;
  marginCents: bigint;
  margin12mCents: bigint;
  firstPurchaseOn: Date | null;
  lastPurchaseOn: Date | null;
  cycleDays: number | null;
  segment: Segmento | null;
  contentHash: string;
};

export type ResultadoDeFichas = {
  clientas: number;
  nuevas: number;
  cambiadas: number;
  quitadas: number;
  sinTelefono: number;
  /** Con teléfono, pero sin una compra válida en lo que está leído: no tienen segmento. */
  sinCompras: number;
  segmentos: Record<Segmento, number>;
};

/**
 * Arma la ficha única desde el espejo, así que fuera de producción ya está anonimizada,
 * con sus métricas y su segmento: se guardan para filtrar y paginar en la base.
 * Repetirlo no cambia nada: el ID de cada clienta se conserva. Si una clienta se queda
 * sin fichas, porque DUX le cambió el teléfono, se quita.
 */
export async function recalcularClientas(ahora: Date): Promise<ResultadoDeFichas> {
  const db = getDb();
  const hoy = businessTime.today(ahora);
  const [fichas, existentes] = await Promise.all([
    db.duxCustomer.findMany({
      select: {
        duxId: true,
        name: true,
        firstName: true,
        phone: true,
        normalizedPhone: true,
        email: true,
        province: true,
        city: true,
        createdOn: true,
      },
    }),
    db.customer.findMany({ select: { id: true, normalizedPhone: true, contentHash: true } }),
  ]);

  const telefonos = new Map(fichas.map(({ duxId, normalizedPhone }) => [duxId, normalizedPhone]));
  const comprobantes = await db.duxInvoice.findMany({
    where: {
      ...VENTA_VALIDA,
      customerDuxId: { in: fichas.filter(({ normalizedPhone }) => normalizedPhone).map(({ duxId }) => duxId) },
    },
    select: {
      customerDuxId: true,
      issuedOn: true,
      totalCents: true,
      items: {
        select: { kind: true, code: true, quantity: true, unitPriceCents: true, discountPct: true, costCents: true },
      },
    },
  });

  const ultimaCompra = new Map<number | null, string>();
  const porTelefono = new Map<string, ComprobanteDeClienta[]>();
  for (const { customerDuxId, issuedOn, totalCents, items } of comprobantes) {
    const fecha = dia(issuedOn);
    if (fecha > (ultimaCompra.get(customerDuxId) ?? "")) ultimaCompra.set(customerDuxId, fecha);
    const telefono = telefonos.get(customerDuxId ?? -1);
    if (!telefono) continue;
    porTelefono.set(telefono, [
      ...(porTelefono.get(telefono) ?? []),
      {
        fecha,
        totalCentavos: Number(totalCents),
        lineas: items.map((linea) => ({
          tipo: linea.kind,
          codigo: linea.code,
          cantidad: linea.quantity.toNumber(),
          precioCentavos: Number(linea.unitPriceCents),
          descuentoPct: linea.discountPct.toNumber(),
          costoCentavos: Number(linea.costCents),
        })),
      },
    ]);
  }

  const { clientas, sinTelefono } = unirFichas(
    fichas.map(({ createdOn, ...ficha }) => ({
      ...ficha,
      creadaEl: createdOn && dia(createdOn),
      ultimaCompra: ultimaCompra.get(ficha.duxId) ?? null,
    })),
  );

  const metricas = new Map(
    [...porTelefono].map(([telefono, lista]) => [telefono, calcularMetricas(lista, hoy)] as const),
  );
  const umbral = umbralTop(
    [...metricas.values()].filter((valor) => valor !== null),
    hoy,
  );
  const filas = clientas.map((clienta): FilaDeClienta => {
    const propias = metricas.get(clienta.normalizedPhone) ?? null;
    const segment = propias && elegirSegmento(propias, umbral, hoy);
    return {
      ...clienta,
      purchases: propias?.compras ?? 0,
      totalCents: BigInt(propias?.totalCentavos ?? 0),
      marginCents: BigInt(propias?.margenCentavos ?? 0),
      margin12mCents: BigInt(propias?.margen12mCentavos ?? 0),
      firstPurchaseOn: propias && aFecha(propias.primeraCompra),
      lastPurchaseOn: propias && aFecha(propias.ultimaCompra),
      cycleDays: propias?.cicloDias ?? null,
      segment,
      contentHash: huella({ clienta, propias, segment }),
    };
  });

  const previas = new Map(existentes.map((fila) => [fila.normalizedPhone, fila]));
  const nuevas = filas.filter(({ normalizedPhone }) => !previas.has(normalizedPhone));
  const cambiadas = filas.filter((fila) => {
    const previa = previas.get(fila.normalizedPhone);
    return previa !== undefined && previa.contentHash !== fila.contentHash;
  });
  const vigentes = new Set(filas.map(({ normalizedPhone }) => normalizedPhone));
  const quitadas = existentes.filter(({ normalizedPhone }) => !vigentes.has(normalizedPhone)).map(({ id }) => id);

  await db.$transaction([
    db.customer.createMany({
      data: nuevas.map((fila) => ({ id: newId(), ...fila, firstSeenAt: ahora, changedAt: ahora })),
    }),
    // Una sola sentencia: con una por fila, cuando cambian todas no entra en los 5 s de la transacción.
    db.$executeRaw`
      UPDATE customers AS c SET
        name = d.name,
        first_name = d.first_name,
        phone = d.phone,
        email = d.email,
        province = d.province,
        city = d.city,
        dux_records = d.dux_records,
        purchases = d.purchases,
        total_cents = d.total_cents,
        margin_cents = d.margin_cents,
        margin_12m_cents = d.margin_12m_cents,
        first_purchase_on = d.first_purchase_on,
        last_purchase_on = d.last_purchase_on,
        cycle_days = d.cycle_days,
        segment = d.segment,
        content_hash = d.content_hash,
        changed_at = ${ahora}
      FROM jsonb_to_recordset(${aJson(cambiadas)}::jsonb) AS d(
        normalized_phone text,
        name text,
        first_name text,
        phone text,
        email text,
        province text,
        city text,
        dux_records int,
        purchases int,
        total_cents bigint,
        margin_cents bigint,
        margin_12m_cents bigint,
        first_purchase_on date,
        last_purchase_on date,
        cycle_days double precision,
        segment customer_segment,
        content_hash text
      )
      WHERE c.normalized_phone = d.normalized_phone`,
    db.customer.deleteMany({ where: { id: { in: quitadas } } }),
  ]);

  const contar = (segmento: Segmento | null) => filas.filter(({ segment }) => segment === segmento).length;
  return {
    clientas: filas.length,
    nuevas: nuevas.length,
    cambiadas: cambiadas.length,
    quitadas: quitadas.length,
    sinTelefono,
    sinCompras: contar(null),
    segmentos: {
      nueva: contar("nueva"),
      activa: contar("activa"),
      top: contar("top"),
      en_riesgo: contar("en_riesgo"),
      dormida: contar("dormida"),
    },
  };
}
