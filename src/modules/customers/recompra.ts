import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { serverEnv } from "@/env";
import type { ReactivationContact } from "@/generated/prisma/client";
import type {
  ClientaParaRecompra,
  ListaDeRecompra,
  RecompraEsperando,
  RecompraEstado,
  RecompraResultados,
  StockFila,
} from "@/lib/api/types";
import { businessTime } from "@/lib/dates";
import { normalizarCodigo } from "@/modules/catalog/codigos";
import { filasDelEspejo } from "@/modules/inventory/espejo-stock";
import { VENTA_VALIDA } from "@/modules/inventory/ventas";
import {
  COMPROBANTE_DE_FICHA,
  detalleDeComprobante,
  numeroDeComprobante,
  productosFrecuentes,
  type Comprobante,
} from "./consultas";
import { aLineaDeCompra, LINEA_DE_COMPRA } from "./fichas";
import { diasEntre, margenDeLinea } from "./metricas";
import {
  armarMensaje,
  elegir,
  ETAPA_LABEL,
  etapaQueToca,
  faltaCompletar,
  productoEnMensaje,
  resultadosDeContactos,
  rotacionDe,
  rubroEnMensaje,
  umbralAltoValor,
  VALORES_DE_RECOMPRA,
  type ClientaEnSecuencia,
  type ContactoPrevio,
  type DatosDelMensaje,
  type Etapa,
} from "./secuencia";

/**
 * La lista del día y lo que se hizo con ella. La lista no se guarda: sale de las compras y
 * de `reactivation_contacts`. Por eso no cambia durante el día: lo marcado hoy sigue en
 * pantalla y ocupa su lugar en el tope. La app no manda nada.
 */

const CATEGORIAS_DE_LA_SEMANA = 3;
const DIAS_DE_RESULTADOS = 30;

const CLIENTA_DE_LISTA = {
  id: true,
  name: true,
  firstName: true,
  phone: true,
  normalizedPhone: true,
  segment: true,
  purchases: true,
  totalCents: true,
  margin12mCents: true,
  lastPurchaseOn: true,
  cycleDays: true,
} as const;

type ClientaDeLista = {
  id: string;
  name: string;
  firstName: string | null;
  phone: string;
  normalizedPhone: string;
  segment: ClientaParaRecompra["segmento"];
  purchases: number;
  totalCents: bigint;
  margin12mCents: bigint;
  lastPurchaseOn: Date | null;
  cycleDays: number | null;
};

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00Z`);
const pesos = (centavos: bigint) => Number(centavos) / 100;

const enSecuencia = (clienta: ClientaDeLista): ClientaEnSecuencia => ({
  ultimaCompra: clienta.lastPurchaseOn ? dia(clienta.lastPurchaseOn) : "",
  compras: clienta.purchases,
  cicloDias: clienta.cycleDays,
  margen12mCentavos: Number(clienta.margin12mCents),
});

const previos = (filas: ReactivationContact[]): ContactoPrevio[] =>
  filas.map(({ contactedOn, stage, variant, status }) => ({
    fecha: dia(contactedOn),
    etapa: stage,
    variante: variant,
    estado: status,
  }));

async function umbralDeHoy(): Promise<number> {
  const dormidas = await getDb().customer.findMany({
    where: { segment: "dormida" },
    select: { margin12mCents: true },
  });
  return umbralAltoValor(dormidas.map(({ margin12mCents }) => Number(margin12mCents)));
}

/* ---- Lo que los mensajes pueden decir ------------------------------------------- */

async function categoriasDeLaSemana(stock: StockFila[], hoy: string): Promise<string[]> {
  const desde = aFecha(businessTime.addDays(hoy, -7));
  const rubros = await getDb().$queryRaw<{ rubro: string | null }[]>`
    SELECT it.category AS rubro
    FROM dux_invoice_items l
    JOIN dux_invoices f ON f.id = l.invoice_id
    JOIN dux_items it ON it.normalized_code = upper(regexp_replace(l.code, '\s+', '', 'g'))
    WHERE f.cancelled = false AND f.type NOT LIKE '%NOTA_CREDITO%' AND f.issued_on >= ${desde}
      AND l.kind <> 'no_producto'
    GROUP BY it.category
    ORDER BY SUM(l.quantity * l.unit_price_cents * (1 - l.discount_pct / 100)) DESC`;
  const conBulto = new Set(stock.filter(({ disponibleBultos }) => disponibleBultos > 0).map(({ rubro }) => rubro));
  return rubros
    .filter(({ rubro }) => rubro !== null && conBulto.has(rubro))
    .flatMap(({ rubro }) => rubroEnMensaje(rubro) ?? [])
    .slice(0, CATEGORIAS_DE_LA_SEMANA);
}

type Novedad = { nombre: string; rubro: string; alta: string };

/** Lo recién dado de alta que tiene un bulto en stock (RN-75), de lo más nuevo a lo más viejo. */
async function novedades(stock: Map<string, StockFila>, hoy: string) {
  const { productoNuevoDias, comboNuevoDias } = VALORES_DE_RECOMPRA;
  const items = await getDb().duxItem.findMany({
    where: {
      present: true,
      kind: { in: ["prenda", "combo"] },
      createdOn: { gte: aFecha(businessTime.addDays(hoy, -Math.max(productoNuevoDias, comboNuevoDias))) },
    },
    orderBy: [{ createdOn: "desc" }, { code: "asc" }],
    select: { code: true, name: true, kind: true, category: true, subcategory: true, createdOn: true },
  });
  const conBulto = items.filter(({ code }) => (stock.get(normalizarCodigo(code))?.disponibleBultos ?? 0) > 0);
  const desdeProducto = businessTime.addDays(hoy, -productoNuevoDias);
  return {
    productos: conBulto.flatMap((item): Novedad[] =>
      item.kind === "prenda" && item.category && dia(item.createdOn) >= desdeProducto
        ? [{ nombre: item.name, rubro: item.category, alta: dia(item.createdOn) }]
        : [],
    ),
    combos: conBulto.flatMap((item) => (item.kind === "combo" ? (rubroEnMensaje(item.subcategory) ?? []) : [])),
  };
}

/** El rubro y los productos de lo que compró, del más reciente al más viejo. */
function loQueCompro(lista: Comprobante[], stock: Map<string, StockFila>): StockFila[] {
  const codigos = lista.flatMap(({ items }) =>
    items.filter(({ kind }) => kind !== "no_producto").map(({ baseCode }) => normalizarCodigo(baseCode)),
  );
  return [...new Set(codigos)].flatMap((codigo) => stock.get(codigo) ?? []);
}

/** Todo lo que hace falta para armar los mensajes de estas clientas, de una sola lectura. */
async function contextoDe(clientas: ClientaDeLista[], hoy: string) {
  const db = getDb();
  const filas = await filasDelEspejo();
  const stock = new Map(filas.map((fila) => [normalizarCodigo(fila.sku), fila]));
  const [categorias, nuevas, fichas] = await Promise.all([
    categoriasDeLaSemana(filas, hoy),
    novedades(stock, hoy),
    db.duxCustomer.findMany({
      where: { normalizedPhone: { in: clientas.map(({ normalizedPhone }) => normalizedPhone) } },
      select: { duxId: true, normalizedPhone: true },
    }),
  ]);
  const comprobantes = await db.duxInvoice.findMany({
    where: { ...VENTA_VALIDA, customerDuxId: { in: fichas.map(({ duxId }) => duxId) } },
    orderBy: [{ issuedOn: "desc" }, { duxId: "desc" }],
    select: COMPROBANTE_DE_FICHA,
  });

  const telefonoDe = new Map(fichas.map(({ duxId, normalizedPhone }) => [duxId, normalizedPhone]));
  const porTelefono = new Map<string, Comprobante[]>();
  for (const comprobante of comprobantes) {
    const telefono = telefonoDe.get(comprobante.customerDuxId ?? -1);
    if (telefono) porTelefono.set(telefono, [...(porTelefono.get(telefono) ?? []), comprobante]);
  }

  return {
    comprobantesDe: (clienta: ClientaDeLista) => porTelefono.get(clienta.normalizedPhone) ?? [],
    datosDe(clienta: ClientaDeLista, semilla: string): DatosDelMensaje {
      const comprado = loQueCompro(porTelefono.get(clienta.normalizedPhone) ?? [], stock);
      const parecidas = nuevas.productos.filter(({ rubro }) => rubro === comprado[0]?.rubro);
      const nueva = elegir(
        parecidas.filter(({ alta }) => alta === parecidas[0]?.alta),
        semilla,
      );
      const porAgotarse = comprado.find(({ estado, disponibleBultos }) => estado === "critico" && disponibleBultos > 0);
      return {
        nombre: clienta.firstName,
        categorias,
        productoNuevo: nueva ? productoEnMensaje(nueva.nombre) : null,
        comboNuevo: elegir(nuevas.combos, semilla) ?? null,
        productoPorAgotarse: porAgotarse ? productoEnMensaje(porAgotarse.nombre) : null,
      };
    },
  };
}

/* ---- La lista del día --------------------------------------------------------- */

function notaDe(etapa: Etapa, firstName: string | null, mensaje: string): string | undefined {
  if (!firstName) return "DUX no tiene su nombre de pila: completalo antes de mandar.";
  if (faltaCompletar(mensaje)) return "Completá lo que está entre corchetes antes de mandar.";
  if (etapa === "alto_valor") return "Es un mensaje personal: adaptalo antes de mandarlo.";
  return undefined;
}

function motivoDe(etapa: Etapa, clienta: ClientaDeLista, hoy: string): string {
  const dias = diasEntre(enSecuencia(clienta).ultimaCompra, hoy);
  if (etapa === "reactivacion" || etapa === "alto_valor") return `${dias} días sin comprar`;
  return `Compró hace ${dias} días · rotación ${rotacionDe(clienta.cycleDays) === "rapida" ? "rápida" : "lenta"}`;
}

type Contexto = Awaited<ReturnType<typeof contextoDe>>;

function armarItem(
  clienta: ClientaDeLista,
  etapa: Etapa,
  contactos: ReactivationContact[],
  contexto: Contexto,
  hoy: string,
): { item: ClientaParaRecompra; variante: string } {
  const propios = previos(contactos).filter(({ estado }) => estado !== "pospuesta");
  const ultimaVariante = propios.findLast((contacto) => contacto.etapa === etapa)?.variante ?? null;
  const semilla = `${clienta.id}-${etapa}-${enSecuencia(clienta).ultimaCompra}`;
  const { variante, texto } = armarMensaje(etapa, contexto.datosDe(clienta, semilla), semilla, ultimaVariante);
  const deHoy = contactos.find(({ contactedOn }) => dia(contactedOn) === hoy);
  const mensaje = deHoy?.message ?? texto;

  const lista = contexto.comprobantesDe(clienta);
  const ultimo = lista[0];
  const local = serverEnv().DUX_ID_SUCURSAL_LOCAL;

  const item: ClientaParaRecompra = {
    id: clienta.id,
    nombre: clienta.name,
    telefono: clienta.phone,
    telefonoWa: `549${clienta.normalizedPhone}`,
    segmento: clienta.segment,
    tipo: etapa === "reactivacion" || etapa === "alto_valor" ? "reactivacion" : "recompra",
    etapa,
    etapaLabel: ETAPA_LABEL[etapa],
    motivo: motivoDe(etapa, clienta, hoy),
    ultimaCompraDias: diasEntre(enSecuencia(clienta).ultimaCompra, hoy),
    cicloDias: clienta.cycleDays,
    totalComprado: pesos(clienta.totalCents),
    ultimoPedido: ultimo
      ? {
          id: numeroDeComprobante(ultimo),
          total: pesos(ultimo.totalCents),
          resumen: detalleDeComprobante(ultimo.branchId === local, ultimo.items),
          haceDias: diasEntre(dia(ultimo.issuedOn), hoy),
        }
      : null,
    skus: productosFrecuentes(lista).map(({ sku, nombre, colores }) => ({ sku, nombre, colores })),
    mensaje,
    nota: notaDe(etapa, clienta.firstName, mensaje),
    estado: deHoy?.status ?? "pendiente",
  };
  return { item, variante };
}

export async function listaDeRecompra(hoy: string = businessTime.today()): Promise<ListaDeRecompra> {
  const db = getDb();
  const [clientas, contactos, umbral] = await Promise.all([
    db.customer.findMany({
      where: { purchases: { gt: 0 } },
      orderBy: [{ margin12mCents: "desc" }, { id: "asc" }],
      select: CLIENTA_DE_LISTA,
    }),
    db.reactivationContact.findMany({ orderBy: { contactedOn: "asc" } }),
    umbralDeHoy(),
  ]);

  const porClienta = new Map<string, ReactivationContact[]>();
  for (const contacto of contactos) {
    porClienta.set(contacto.customerId, [...(porClienta.get(contacto.customerId) ?? []), contacto]);
  }
  const deHoy = new Map(contactos.filter((c) => dia(c.contactedOn) === hoy).map((c) => [c.customerId, c]));

  // Primero lo que ya se marcó hoy, que sigue en pantalla; el resto de los lugares, por margen.
  const etapas = new Map<string, Etapa>();
  for (const clienta of clientas) {
    const etapa = deHoy.has(clienta.id)
      ? (deHoy.get(clienta.id)?.stage ?? null)
      : etapaQueToca(enSecuencia(clienta), previos(porClienta.get(clienta.id) ?? []), umbral, hoy);
    if (etapa) etapas.set(clienta.id, etapa);
  }
  const pendientes = clientas.filter(({ id }) => etapas.has(id) && !deHoy.has(id));
  const lugares = Math.max(0, VALORES_DE_RECOMPRA.contactosPorDia - deHoy.size);
  const entran = new Set(pendientes.slice(0, lugares).map(({ id }) => id));
  const deLaLista = clientas.filter(({ id }) => deHoy.has(id) || entran.has(id));

  const desde = businessTime.addDays(hoy, -VALORES_DE_RECOMPRA.diasEntreMensajes);
  const porId = new Map(clientas.map((clienta) => [clienta.id, clienta]));
  const esperando = contactos
    .filter(({ contactedOn, status, customerId }) => {
      const fecha = dia(contactedOn);
      const clienta = porId.get(customerId);
      return (
        status !== "pospuesta" &&
        fecha < hoy &&
        fecha >= desde &&
        clienta !== undefined &&
        fecha > enSecuencia(clienta).ultimaCompra
      );
    })
    .toReversed()
    .flatMap((contacto): RecompraEsperando[] => {
      const clienta = porId.get(contacto.customerId);
      if (!clienta) return [];
      return [
        {
          id: clienta.id,
          nombre: clienta.name,
          telefono: clienta.phone,
          etapaLabel: ETAPA_LABEL[contacto.stage],
          contactadaHaceDias: diasEntre(dia(contacto.contactedOn), hoy),
          estado: contacto.status === "respondio" ? "respondio" : "contactada",
        },
      ];
    });

  const contexto = await contextoDe(deLaLista, hoy);
  return {
    hoy: deLaLista.map(
      (clienta) =>
        armarItem(clienta, etapas.get(clienta.id) as Etapa, porClienta.get(clienta.id) ?? [], contexto, hoy).item,
    ),
    esperando,
    enCola: pendientes.length - entran.size,
    tope: VALORES_DE_RECOMPRA.contactosPorDia,
  };
}

/* ---- Lo que se hizo ------------------------------------------------------------- */

export class RecompraNoCorresponde extends Error {}

/**
 * Guarda lo que hizo la persona. `pendiente` deshace lo marcado hoy. Quien responde suele
 * hacerlo días después, así que `respondio` va sobre su último mensaje de este ciclo; y
 * `contactada` sobre una que figura como respondió la vuelve atrás.
 */
export async function marcarRecompra(
  id: string,
  { estado, mensaje }: { estado: RecompraEstado; mensaje?: string },
  actorId: string | null,
  hoy: string = businessTime.today(),
): Promise<{ estado: RecompraEstado } | null> {
  const db = getDb();
  const clienta = await db.customer.findUnique({ where: { id }, select: CLIENTA_DE_LISTA });
  if (!clienta?.lastPurchaseOn) return null;

  const contactos = await db.reactivationContact.findMany({
    where: { customerId: id },
    orderBy: { contactedOn: "asc" },
  });
  const deHoy = contactos.find(({ contactedOn }) => dia(contactedOn) === hoy);
  const ahora = new Date();

  if (estado === "pendiente") {
    if (deHoy) await db.reactivationContact.delete({ where: { id: deHoy.id } });
    return { estado };
  }

  const ultimaCompra = dia(clienta.lastPurchaseOn);
  const ultimoDelCiclo = contactos.findLast(
    ({ contactedOn, status }) => status !== "pospuesta" && dia(contactedOn) > ultimaCompra,
  );

  if (estado === "respondio" && ultimoDelCiclo) {
    await db.reactivationContact.update({
      where: { id: ultimoDelCiclo.id },
      data: { status: "respondio", respondedOn: aFecha(hoy), updatedAt: ahora, actorId },
    });
    return { estado };
  }
  if (estado === "contactada" && ultimoDelCiclo?.status === "respondio") {
    await db.reactivationContact.update({
      where: { id: ultimoDelCiclo.id },
      data: { status: "contactada", respondedOn: null, updatedAt: ahora, actorId },
    });
    return { estado };
  }
  if (deHoy) {
    await db.reactivationContact.update({
      where: { id: deHoy.id },
      data: { status: estado, message: mensaje ?? deHoy.message, updatedAt: ahora, actorId },
    });
    return { estado };
  }

  const etapa = etapaQueToca(enSecuencia(clienta), previos(contactos), await umbralDeHoy(), hoy);
  if (!etapa) throw new RecompraNoCorresponde("Hoy no le toca ningún mensaje a esta clienta.");

  const { item, variante } = armarItem(clienta, etapa, contactos, await contextoDe([clienta], hoy), hoy);
  await db.reactivationContact.create({
    data: {
      id: newId(),
      customerId: id,
      contactedOn: aFecha(hoy),
      stage: etapa,
      variant: variante,
      status: estado,
      message: mensaje ?? item.mensaje,
      respondedOn: estado === "respondio" ? aFecha(hoy) : null,
      actorId,
      createdAt: ahora,
      updatedAt: ahora,
    },
  });
  return { estado };
}

/** Los mensajes de los últimos 30 días y lo que compraron esas clientas después. */
export async function resultadosDeRecompra(hoy: string = businessTime.today()): Promise<RecompraResultados> {
  const db = getDb();
  const desde = aFecha(businessTime.addDays(hoy, -DIAS_DE_RESULTADOS));
  const contactos = await db.reactivationContact.findMany({
    where: { contactedOn: { gte: desde }, status: { not: "pospuesta" } },
    select: { customerId: true, contactedOn: true, customer: { select: { normalizedPhone: true } } },
  });
  const telefonos = [...new Set(contactos.map(({ customer }) => customer.normalizedPhone))];
  const fichas = await db.duxCustomer.findMany({
    where: { normalizedPhone: { in: telefonos } },
    select: { duxId: true, normalizedPhone: true },
  });
  const comprobantes = await db.duxInvoice.findMany({
    where: { ...VENTA_VALIDA, customerDuxId: { in: fichas.map(({ duxId }) => duxId) }, issuedOn: { gt: desde } },
    select: {
      duxId: true,
      customerDuxId: true,
      issuedOn: true,
      totalCents: true,
      items: { select: LINEA_DE_COMPRA },
    },
  });

  const clientaDelTelefono = new Map(contactos.map((c) => [c.customer.normalizedPhone, c.customerId]));
  const telefonoDe = new Map(fichas.map(({ duxId, normalizedPhone }) => [duxId, normalizedPhone]));
  const resultado = resultadosDeContactos(
    contactos.map(({ customerId, contactedOn }) => ({ clienta: customerId, fecha: dia(contactedOn) })),
    comprobantes.map(({ duxId, customerDuxId, issuedOn, totalCents, items }) => ({
      clienta: clientaDelTelefono.get(telefonoDe.get(customerDuxId ?? -1) ?? "") ?? "",
      id: duxId,
      fecha: dia(issuedOn),
      totalCentavos: Number(totalCents),
      margenCentavos: items.reduce((suma, linea) => suma + margenDeLinea(aLineaDeCompra(linea)), 0),
    })),
  );

  return {
    contactadas: resultado.contactadas,
    compraron: resultado.compraron,
    ventas: resultado.ventasCentavos / 100,
    margen: resultado.margenCentavos / 100,
  };
}
