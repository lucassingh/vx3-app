import "server-only";
import { getDb } from "@/db/client";
import { serverEnv } from "@/env";
import type { Customer } from "@/generated/prisma/client";
import type {
  ClientaFila,
  ClientasCobertura,
  ClientasQuery,
  DuplicadoClienta,
  FichaClienta,
  Paginated,
  Segmento,
  SegmentoResumen,
} from "@/lib/api/types";
import { businessTime } from "@/lib/dates";
import { normalizeText } from "@/lib/utils";
import { VENTA_VALIDA } from "@/modules/inventory/ventas";
import { DIAS_12_MESES } from "./metricas";

/**
 * Lo que muestran las pantallas de clientas, leído de Postgres con el contrato de la
 * maqueta. La zona y el CP llegan con el cotizador (2.1), y el origen por anuncio con
 * Meta (1.6). Lo demás de la ficha, con la PR de cada módulo.
 */

const SEGMENTOS: Segmento[] = ["nueva", "activa", "top", "en_riesgo", "dormida"];
const DIA_MS = 86_400_000;

const pesos = (centavos: bigint) => Number(centavos) / 100;
const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const diasDesde = (fecha: Date, hoy: string) => Math.round((Date.parse(hoy) - fecha.getTime()) / DIA_MS);
const comprobantes = (cantidad: number) => `${cantidad} ${cantidad === 1 ? "comprobante" : "comprobantes"}`;

function aFila(clienta: Customer, hoy: string): ClientaFila {
  return {
    id: clienta.id,
    nombre: clienta.name,
    telefono: clienta.phone,
    localidad: clienta.city,
    provincia: clienta.province,
    zona: null,
    segmento: clienta.segment,
    origen: clienta.firstPurchaseLocal ? "local" : "sin_dato",
    origenLabel: clienta.firstPurchaseLocal ? "Local" : "Sin dato",
    pedidos: clienta.purchases,
    totalComprado: pesos(clienta.totalCents),
    margen: pesos(clienta.marginCents),
    ultimaCompraDias: clienta.lastPurchaseOn && diasDesde(clienta.lastPurchaseOn, hoy),
    cicloDias: clienta.cycleDays,
  };
}

function buscar(q: string | undefined) {
  const texto = normalizeText(q?.trim() ?? "");
  if (!texto) return {};
  const digitos = texto.replace(/\D/g, "").slice(-10);
  return {
    OR: [
      { searchText: { contains: texto } },
      ...(digitos.length >= 3 ? [{ normalizedPhone: { contains: digitos } }] : []),
    ],
  };
}

/** Sin una compra quedan al final: el orden es por lo que compró cada una. */
export async function listarClientas({
  q,
  segmento,
  page = 1,
  pageSize = 8,
}: ClientasQuery): Promise<Paginated<ClientaFila>> {
  const db = getDb();
  const where = { ...buscar(q), ...(segmento ? { segment: segmento } : {}) };
  const total = await db.customer.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagina = Math.min(page, totalPages);
  const filas = await db.customer.findMany({
    where,
    orderBy: [{ totalCents: "desc" }, { name: "asc" }, { id: "asc" }],
    skip: (pagina - 1) * pageSize,
    take: pageSize,
  });

  const hoy = businessTime.today();
  return { data: filas.map((fila) => aFila(fila, hoy)), page: pagina, pageSize, total, totalPages };
}

/** La parte del margen es sobre los últimos 12 meses, el mismo que define quién es Top. */
export async function segmentosDeClientas(): Promise<SegmentoResumen[]> {
  const grupos = await getDb().customer.groupBy({
    by: ["segment"],
    _count: true,
    _sum: { margin12mCents: true },
  });
  const margenDe = (grupo: (typeof grupos)[number] | undefined) => pesos(grupo?._sum.margin12mCents ?? 0n);
  const total = grupos.reduce((suma, grupo) => suma + margenDe(grupo), 0);

  return SEGMENTOS.map((segmento) => {
    const grupo = grupos.find((item) => item.segment === segmento);
    const margen = margenDe(grupo);
    return { segmento, clientas: grupo?._count ?? 0, margen, participacion: total > 0 ? margen / total : 0 };
  });
}

/** Lo que no tiene teléfono no se atribuye a nadie: es sobre todo el local a consumidor final. */
export async function coberturaDeClientas(): Promise<ClientasCobertura> {
  const db = getDb();
  const desde = new Date(`${businessTime.addDays(businessTime.today(), -DIAS_12_MESES)}T00:00:00Z`);
  const [[venta], sinCompras] = await Promise.all([
    db.$queryRaw<{ total: number | null; identificada: number | null }[]>`
      SELECT SUM(f.total_cents)::float8 AS total,
        (SUM(f.total_cents) FILTER (WHERE c.normalized_phone IS NOT NULL))::float8 AS identificada
      FROM dux_invoices f
      LEFT JOIN dux_customers c ON c.dux_id = f.customer_dux_id
      WHERE f.cancelled = false AND f.type NOT LIKE '%NOTA_CREDITO%' AND f.issued_on >= ${desde}`,
    db.customer.count({ where: { segment: null } }),
  ]);
  return { ventaIdentificada: venta?.total ? (venta.identificada ?? 0) / venta.total : 0, sinCompras };
}

async function comprobantesPorFicha(duxIds: number[]): Promise<Map<number | null, number>> {
  const grupos = await getDb().duxInvoice.groupBy({
    by: ["customerDuxId"],
    where: { ...VENTA_VALIDA, customerDuxId: { in: duxIds } },
    _count: true,
  });
  return new Map(grupos.map(({ customerDuxId, _count }) => [customerDuxId, _count]));
}

/** Las clientas con más de una ficha en DUX: la unión es automática, y esto es para revisarla. */
export async function clientasUnificadas(): Promise<DuplicadoClienta[]> {
  const db = getDb();
  const clientas = await db.customer.findMany({
    where: { duxRecords: { gt: 1 } },
    orderBy: [{ duxRecords: "desc" }, { totalCents: "desc" }, { id: "asc" }],
    select: { id: true, name: true, normalizedPhone: true, duxRecords: true },
  });
  const fichas = await db.duxCustomer.findMany({
    where: { normalizedPhone: { in: clientas.map(({ normalizedPhone }) => normalizedPhone) } },
    orderBy: { duxId: "asc" },
    select: { duxId: true, name: true, phone: true, normalizedPhone: true },
  });
  const cantidades = await comprobantesPorFicha(fichas.map(({ duxId }) => duxId));

  return clientas.map(({ id, name, normalizedPhone, duxRecords }) => ({
    id,
    clientaId: id,
    nombre: name,
    telefonoNormalizado: normalizedPhone,
    motivo: `${duxRecords} fichas de DUX con el mismo teléfono`,
    registros: fichas
      .filter((ficha) => ficha.normalizedPhone === normalizedPhone)
      .map((ficha) => ({
        sistema: "DUX",
        nombre: ficha.name,
        detalle: `Teléfono ${ficha.phone} · ${comprobantes(cantidades.get(ficha.duxId) ?? 0)}`,
      })),
  }));
}

type Comprobante = {
  issuedOn: Date;
  items: { kind: string; baseCode: string; name: string }[];
};

/** Las veces son días con esa compra, igual que las compras de la clienta. El nombre es el más reciente. */
function productosFrecuentes(lista: Comprobante[]): FichaClienta["skusFrecuentes"] {
  const productos = new Map<string, { nombre: string; dias: Set<string> }>();
  for (const { issuedOn, items } of lista) {
    for (const { kind, baseCode, name } of items) {
      if (kind === "no_producto") continue;
      const producto = productos.get(baseCode) ?? { nombre: name, dias: new Set<string>() };
      producto.dias.add(dia(issuedOn));
      productos.set(baseCode, producto);
    }
  }
  return [...productos]
    .map(([sku, { nombre, dias }]) => ({ sku, nombre, colores: [], veces: dias.size }))
    .toSorted((a, b) => b.veces - a.veces)
    .slice(0, 4);
}

function detalleDeComprobante(enLocal: boolean, items: Comprobante["items"]): string {
  const canal = enLocal ? "Local" : "E-commerce";
  const codigos = [...new Set(items.filter(({ kind }) => kind !== "no_producto").map(({ baseCode }) => baseCode))];
  if (codigos.length === 0) return canal;
  const resto = codigos.length > 4 ? ` y ${codigos.length - 4} más` : "";
  return `${canal} · ${codigos.slice(0, 4).join(", ")}${resto}`;
}

export async function fichaDeClienta(id: string): Promise<FichaClienta | null> {
  const db = getDb();
  const clienta = await db.customer.findUnique({ where: { id } });
  if (!clienta) return null;

  const fichas = await db.duxCustomer.findMany({
    where: { normalizedPhone: clienta.normalizedPhone },
    orderBy: { duxId: "asc" },
    select: { duxId: true, name: true, phone: true },
  });
  const duxIds = fichas.map(({ duxId }) => duxId);
  const lista = await db.duxInvoice.findMany({
    where: { ...VENTA_VALIDA, customerDuxId: { in: duxIds } },
    orderBy: [{ issuedOn: "desc" }, { duxId: "desc" }],
    select: {
      duxId: true,
      issuedOn: true,
      branchId: true,
      letter: true,
      pointOfSale: true,
      number: true,
      totalCents: true,
      customerDuxId: true,
      items: { select: { kind: true, baseCode: true, name: true } },
    },
  });
  const cantidades = new Map<number | null, number>();
  for (const { customerDuxId } of lista) cantidades.set(customerDuxId, (cantidades.get(customerDuxId) ?? 0) + 1);

  const hoy = businessTime.today();
  const local = serverEnv().DUX_ID_SUCURSAL_LOCAL;
  const total = pesos(clienta.totalCents);

  return {
    ...aFila(clienta, hoy),
    cp: null,
    primeraCompraDias: clienta.firstPurchaseOn && diasDesde(clienta.firstPurchaseOn, hoy),
    ticketPromedio: clienta.purchases > 0 ? Math.round(total / clienta.purchases) : 0,
    telefonoNormalizado: clienta.normalizedPhone,
    identidades: fichas.map((ficha) => ({
      sistema: "DUX",
      valor: ficha.phone ?? clienta.normalizedPhone,
      detalle: `${ficha.name} · ${comprobantes(cantidades.get(ficha.duxId) ?? 0)}`,
    })),
    anuncioOrigen: null,
    skusFrecuentes: productosFrecuentes(lista),
    eventos: lista.map(({ duxId, issuedOn, branchId, letter, pointOfSale, number, totalCents, items }) => ({
      id: String(duxId),
      tipo: "pedido",
      titulo:
        number === null
          ? "Comprobante sin número"
          : `Comprobante ${letter} ${pointOfSale}-${String(number).padStart(8, "0")}`,
      detalle: detalleDeComprobante(branchId === local, items),
      fecha: businessTime.startOfDay(dia(issuedOn)).toISOString(),
      monto: pesos(totalCents),
    })),
  };
}
