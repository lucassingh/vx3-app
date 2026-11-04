import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { leerCodigo, normalizarCodigo, unidadesDelNombre } from "@/modules/catalog/codigos";
import type { ErpComprobante, ErpLinea } from "./erp-gateway";
import { CORTE_PRENDA_BULTO } from "./ventas";

/**
 * Espejo de los comprobantes de venta. Se relee una ventana hacia atrás, porque una
 * factura puede anularse después: si no cambió, no se toca. Los anulados y las notas
 * de crédito se guardan marcados (VENTA_VALIDA): tienen que verse si cambian.
 */

function huella(comprobante: ErpComprobante): string {
  return createHash("sha256").update(JSON.stringify(comprobante)).digest("hex");
}

/** Sin código en el espejo, por ejemplo un pack viejo, el rubro se deduce del nombre. */
function aLineaFila(
  linea: ErpLinea,
  posicion: number,
  fecha: string,
  rubros: Map<string, string | null>,
  invoiceId: string,
) {
  const rubro = rubros.get(normalizarCodigo(linea.codigo)) ?? linea.nombre;
  const { tipo, base, cantidad } = leerCodigo(linea.codigo, rubro);
  // Lo único que dice cuánto traía un pack viejo, o un código sin guion antes del corte, es el nombre (RN-120).
  const delNombre = tipo === "pack_viejo" || (tipo === "prenda" && fecha < CORTE_PRENDA_BULTO);
  return {
    id: newId(),
    invoiceId,
    line: posicion,
    code: linea.codigo,
    kind: tipo,
    baseCode: base,
    packQuantity: delNombre ? unidadesDelNombre(linea.nombre) : cantidad,
    name: linea.nombre,
    quantity: linea.cantidad.toFixed(8),
    unitPriceCents: BigInt(linea.precioCentavos),
    discountPct: linea.descuentoPct.toFixed(4),
    vatPct: linea.ivaPct.toFixed(4),
    costCents: BigInt(linea.costoCentavos),
  };
}

function aComprobanteFila(comprobante: ErpComprobante) {
  return {
    duxId: comprobante.id,
    branchId: comprobante.sucursal,
    type: comprobante.tipo,
    letter: comprobante.letra,
    pointOfSale: comprobante.puntoDeVenta,
    number: comprobante.numero,
    issuedOn: new Date(`${comprobante.fecha}T00:00:00Z`),
    customerDuxId: comprobante.clienteId,
    orderNumber: comprobante.pedido,
    totalCents: BigInt(comprobante.totalCentavos),
    cancelled: comprobante.anulado,
    contentHash: huella(comprobante),
  };
}

export type ResultadoDeVentas = { nuevos: number; cambiados: number; sinCambios: number };

export async function guardarComprobantes(comprobantes: ErpComprobante[], ahora: Date): Promise<ResultadoDeVentas> {
  const db = getDb();
  const porId = new Map(comprobantes.map((comprobante) => [comprobante.id, comprobante]));
  const existentes = await db.duxInvoice.findMany({
    where: { duxId: { in: [...porId.keys()] } },
    select: { id: true, duxId: true, contentHash: true },
  });
  const previos = new Map(existentes.map((fila) => [fila.duxId, fila]));

  const codigos = [
    ...new Set(comprobantes.flatMap(({ lineas }) => lineas.map(({ codigo }) => normalizarCodigo(codigo)))),
  ];
  const items = await db.duxItem.findMany({
    where: { normalizedCode: { in: codigos } },
    select: { normalizedCode: true, category: true },
  });
  const rubros = new Map(items.map(({ normalizedCode, category }) => [normalizedCode, category]));

  const nuevos: { id: string; comprobante: ErpComprobante }[] = [];
  const cambiados: { id: string; comprobante: ErpComprobante }[] = [];
  let sinCambios = 0;
  for (const comprobante of porId.values()) {
    const previo = previos.get(comprobante.id);
    if (!previo) nuevos.push({ id: newId(), comprobante });
    else if (previo.contentHash !== huella(comprobante)) cambiados.push({ id: previo.id, comprobante });
    else sinCambios += 1;
  }

  const lineasDe = ({ id, comprobante }: { id: string; comprobante: ErpComprobante }) =>
    comprobante.lineas.map((linea, posicion) => aLineaFila(linea, posicion, comprobante.fecha, rubros, id));

  await db.$transaction([
    db.duxInvoice.createMany({
      data: nuevos.map(({ id, comprobante }) => ({
        id,
        ...aComprobanteFila(comprobante),
        firstSeenAt: ahora,
        changedAt: ahora,
      })),
    }),
    ...cambiados.map(({ id, comprobante }) =>
      db.duxInvoice.update({ where: { id }, data: { ...aComprobanteFila(comprobante), changedAt: ahora } }),
    ),
    // Una línea no tiene ID en DUX: si el comprobante cambió, se reemplazan todas.
    db.duxInvoiceItem.deleteMany({ where: { invoiceId: { in: cambiados.map(({ id }) => id) } } }),
    db.duxInvoiceItem.createMany({ data: [...nuevos, ...cambiados].flatMap(lineasDe) }),
  ]);

  return { nuevos: nuevos.length, cambiados: cambiados.length, sinCambios };
}
