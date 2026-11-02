import type {
  AnuncioTop,
  ClientaParaReactivar,
  CorteHorario,
  EmbudoPaso,
  EstadoPedido,
  IndicadorCausa,
  Kpi,
  OperacionHoy,
  Share,
} from "@/lib/api/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { readInt, type Route } from "../http";
import {
  anuncios,
  clientas,
  contraentregaPendiente,
  dailySeries,
  DAY,
  detalleDe,
  pedidos,
  rmDe,
  TIPO_CAMBIO_USD,
} from "../seed";
import { cobrosViejos } from "./cobros";
import { reclamosSemana } from "./postventa";
import { productosBajoPiso } from "./stock";

/** M10 · Dashboard ejecutivo. Lo que se puede, se calcula desde la semilla y desde los otros dominios. */

const hoy = pedidos.filter((pedido) => pedido.creadoHaceMin < DAY && pedido.estado !== "anulado");

function ventasHoy() {
  return hoy.reduce((sum, pedido) => sum + detalleDe(pedido).total, 0);
}

/** Conversaciones que el equipo marcó como perdidas por un error del bot al revisarlas (P-09). */
const PERDIDAS_ERROR_BOT = 7;

/** Indicadores de resultado de la semana (Manual v4, P-15). */
function kpis(): Kpi[] {
  const facturacion = canales().reduce((sum, canal) => sum + canal.value, 0);
  const cobrado = facturacion - contraentregaPendiente.total;
  const paso = (id: string) => embudo().find((item) => item.id === id)?.value ?? 0;
  const conversaciones = paso("conversaciones");
  const facturados = paso("facturado");
  return [
    {
      id: "facturacion",
      label: "Facturación · 7 días",
      value: facturacion,
      format: "currency",
      delta: { value: 0.06, unit: "percent", period: "vs. la semana anterior", positive: true },
    },
    {
      id: "cobrado",
      label: "Cobrado · 7 días",
      value: cobrado,
      format: "currency",
      hint: `${formatPercent(cobrado / facturacion, { maximumFractionDigits: 0 })} de lo facturado · ${formatCurrency(contraentregaPendiente.total)} de contraentrega sin rendir`,
    },
    {
      id: "pedidos",
      label: "Pedidos · 7 días",
      value: facturados,
      format: "number",
      hint: "18 son recompras, sin costo de pauta",
    },
    {
      id: "conversaciones",
      label: "Conversaciones · 7 días",
      value: conversaciones,
      format: "number",
      delta: { value: 0.03, unit: "percent", period: "vs. la semana anterior", positive: true },
    },
    {
      id: "cierre",
      label: "Tasa de cierre",
      value: facturados / conversaciones,
      format: "percent",
      hint: "Conversaciones que terminan en un pedido facturado",
    },
  ];
}

function costoPorPedido() {
  const porCampana = new Map<string, { gasto: number; pedidos: number }>();
  for (const anuncio of anuncios) {
    const total = porCampana.get(anuncio.campana) ?? { gasto: 0, pedidos: 0 };
    total.gasto += anuncio.gastoUsd7d * TIPO_CAMBIO_USD;
    total.pedidos += anuncio.pedidos7d;
    porCampana.set(anuncio.campana, total);
  }
  const campanas = [...porCampana].filter(([, total]) => total.gasto > 0);
  const gasto = campanas.reduce((sum, [, total]) => sum + total.gasto, 0);
  const pedidosPauta = campanas.reduce((sum, [, total]) => sum + total.pedidos, 0);
  const sinPedidos = campanas.filter(([, total]) => total.pedidos === 0).length;
  const [masCara] = campanas
    .filter(([, total]) => total.pedidos > 0)
    .toSorted(([, a], [, b]) => b.gasto / b.pedidos - a.gasto / a.pedidos);
  return {
    valor: pedidosPauta ? gasto / pedidosPauta : 0,
    sinPedidos,
    masCara: masCara ? { campana: masCara[0], costo: masCara[1].gasto / masCara[1].pedidos } : null,
  };
}

/** Indicadores de causa de la semana (Manual v4, P-15). Cada uno lleva a la pantalla donde se resuelve. */
function causas(): IndicadorCausa[] {
  const bajoPiso = productosBajoPiso();
  const viejos = cobrosViejos();
  const reclamos = reclamosSemana();
  const pauta = costoPorPedido();

  return [
    {
      id: "bajo-piso",
      label: "Productos bajo el piso de margen",
      value: bajoPiso.length,
      format: "number",
      detalle: bajoPiso.length
        ? `${bajoPiso.map((item) => item.codigo).join(", ")}: subió el costo y no el precio`
        : "Todos los precios cubren el piso",
      estado: bajoPiso.length ? "alerta" : "ok",
      href: "/stock/margen",
      accion: "Corregir precios",
    },
    {
      id: "cobros-viejos",
      label: "Cobros pendientes de más de 2 días",
      value: viejos.cantidad,
      format: "number",
      detalle: viejos.cantidad
        ? `${formatCurrency(viejos.monto)} sin cargar en DUX`
        : "Todo cargado dentro de las 24 h",
      estado: viejos.cantidad ? "atencion" : "ok",
      href: "/cobros/conciliacion",
      accion: "Conciliar",
    },
    {
      id: "reclamos",
      label: "Reclamos de la semana",
      value: reclamos.cantidad,
      format: "number",
      detalle: `${formatCurrency(reclamos.monto)} en reintegros${
        reclamos.masFrecuente
          ? ` · el más frecuente: ${reclamos.masFrecuente.label.toLowerCase()} (${reclamos.masFrecuente.cantidad})`
          : ""
      }`,
      estado: reclamos.cantidad > 5 ? "atencion" : "ok",
      href: "/postventa",
      accion: "Ver reclamos",
    },
    {
      id: "costo-pedido",
      label: "Costo por pedido cerrado · pauta",
      value: pauta.valor,
      format: "currency",
      detalle: pauta.sinPedidos
        ? `${pauta.sinPedidos} ${pauta.sinPedidos === 1 ? "campaña gastó" : "campañas gastaron"} sin cerrar pedidos`
        : pauta.masCara
          ? `La más cara: ${pauta.masCara.campana} (${formatCurrency(pauta.masCara.costo)})`
          : "Sin gasto en la semana",
      estado: pauta.sinPedidos ? "atencion" : "ok",
      href: "/pauta/anuncios",
      accion: "Ver campañas",
    },
    {
      id: "errores-bot",
      label: "Conversaciones perdidas por error del bot",
      value: PERDIDAS_ERROR_BOT,
      format: "number",
      detalle: "Marcadas por el equipo al revisar las conversaciones de la semana",
      estado: PERDIDAS_ERROR_BOT > 5 ? "atencion" : "ok",
      href: "/bot/rendimiento",
      accion: "Ver el bot",
    },
  ];
}

/** Ventas diarias de ejemplo en pesos; el último valor es lo facturado hoy hasta ahora. */
const VENTAS_30D = [
  1_180_000, 1_320_000, 1_090_000, 1_460_000, 1_610_000, 1_240_000, 640_000, 1_720_000, 1_380_000, 1_150_000, 1_490_000,
  1_560_000, 1_310_000, 590_000, 1_840_000, 1_420_000, 1_270_000, 1_530_000, 1_690_000, 1_380_000, 710_000, 1_910_000,
  1_470_000, 1_350_000, 1_620_000, 1_780_000, 1_440_000, 760_000, 1_960_000,
];

function canales(): Share[] {
  return [
    { id: "whatsapp", label: "WhatsApp (bot y equipo)", value: 5_940_000 },
    { id: "vidriera", label: "Vidriera", value: 1_620_000 },
    { id: "local", label: "Local", value: 1_310_000 },
    { id: "tiendanube", label: "Tienda Nube", value: 870_000 },
  ];
}

function embudo(): EmbudoPaso[] {
  return [
    { id: "conversaciones", label: "Conversaciones", value: 1_412 },
    { id: "producto", label: "Con producto identificado", value: 1_287 },
    { id: "carrito", label: "Armaron carrito", value: 318 },
    { id: "pedido", label: "Confirmaron pedido", value: 61 },
    { id: "pagado", label: "Pagaron o contraentrega", value: 56 },
    { id: "facturado", label: "Facturados", value: 54 },
    { id: "despachado", label: "Despachados", value: 51 },
  ];
}

/** Hora actual en Buenos Aires, en minutos desde la medianoche. */
function minutosAhoraBA() {
  const parts = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Argentina/Buenos_Aires",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function operacion(): OperacionHoy {
  const orden: EstadoPedido[] = [
    "armandose",
    "pendiente_pago",
    "listo_facturar",
    "facturado",
    "en_armado",
    "despachado",
  ];
  const porEstado = orden.map((estado) => ({
    estado,
    cantidad: hoy.filter((pedido) => pedido.estado === estado).length,
  }));

  const porDespachar = hoy.filter((pedido) => ["listo_facturar", "facturado", "en_armado"].includes(pedido.estado));
  const ahora = minutosAhoraBA();
  const corte = (id: string, label: string, hora: string, transporte: string): CorteHorario => {
    const [h, m] = hora.split(":").map(Number);
    const minutos = h * 60 + m;
    return {
      id,
      label,
      hora,
      pendientes: porDespachar.filter((pedido) => pedido.transporte === transporte).length,
      estado: ahora >= minutos ? "cerrado" : minutos - ahora <= 90 ? "proximo" : "a_tiempo",
    };
  };

  return {
    porEstado,
    trabados: hoy.filter((pedido) => pedido.estado === "armandose" && pedido.creadoHaceMin > 120).length,
    listosParaFacturar: hoy.filter((pedido) => pedido.estado === "listo_facturar").length,
    cortes: [
      corte("mensajeria", "Etiquetas de mensajería", "12:00", "mensajeria"),
      corte("via_cargo", "Vía Cargo", "17:30", "via_cargo"),
      corte("correo", "Correo Argentino", "18:30", "correo"),
    ],
  };
}

function topAnuncios(): AnuncioTop[] {
  return anuncios
    .filter((anuncio) => anuncio.gastoUsd7d > 0)
    .map((anuncio) => ({
      id: anuncio.id,
      nombre: anuncio.nombre,
      sku: anuncio.sku,
      gastoUsd: anuncio.gastoUsd7d,
      pedidos: anuncio.pedidos7d,
      margen: anuncio.margen7d,
      rm: rmDe(anuncio),
      semaforo: anuncio.semaforo,
    }))
    .toSorted((a, b) => (b.rm ?? 0) - (a.rm ?? 0))
    .slice(0, 5);
}

function reactivar(): ClientaParaReactivar[] {
  return clientas
    .filter((clienta) => clienta.segmento === "en_riesgo" || clienta.segmento === "dormida")
    .toSorted((a, b) => b.totalComprado - a.totalComprado)
    .slice(0, 5)
    .map((clienta) => ({
      id: clienta.id,
      nombre: clienta.nombre,
      telefono: clienta.telefono,
      segmento: clienta.segmento,
      ultimaCompraDias: clienta.ultimaCompraDias,
      totalComprado: clienta.totalComprado,
      motivo:
        clienta.cicloDias && clienta.segmento === "en_riesgo"
          ? `Compra cada ${clienta.cicloDias} días y van ${clienta.ultimaCompraDias}`
          : `${clienta.ultimaCompraDias} días sin comprar`,
    }));
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/dashboard\/kpis$/, handler: () => Response.json(kpis()) },
  { method: "GET", pattern: /^\/dashboard\/causas$/, handler: () => Response.json(causas()) },
  {
    method: "GET",
    pattern: /^\/dashboard\/ventas$/,
    handler: ({ url }) => {
      const values = [...VENTAS_30D, ventasHoy()];
      const days = readInt(url.searchParams.get("days"), values.length, values.length);
      return Response.json(dailySeries(values.slice(-days), Date.now()));
    },
  },
  { method: "GET", pattern: /^\/dashboard\/canales$/, handler: () => Response.json(canales()) },
  { method: "GET", pattern: /^\/dashboard\/embudo$/, handler: () => Response.json(embudo()) },
  { method: "GET", pattern: /^\/dashboard\/operacion$/, handler: () => Response.json(operacion()) },
  { method: "GET", pattern: /^\/dashboard\/top-anuncios$/, handler: () => Response.json(topAnuncios()) },
  { method: "GET", pattern: /^\/dashboard\/reactivar$/, handler: () => Response.json(reactivar()) },
];
