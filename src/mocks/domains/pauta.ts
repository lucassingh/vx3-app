import type {
  AnuncioFila,
  AtribucionEstado,
  CampanaPresupuesto,
  DailyPoint,
  Kpi,
  PautaConfig,
  PeriodoPauta,
  PresupuestoMes,
} from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import { anuncios, DAY, getProducto, HOUR, isoAgo, TIPO_CAMBIO_USD, type AnuncioSeed } from "../seed";

/**
 * M9 · Pauta en Meta. Gasto en USD (RN-111), ventas verificadas y margen real
 * línea por línea (RN-92), atribución con el criterio de Elías (RN-110).
 */

// La API simulada no sabe quién está logueado: los cambios quedan a nombre de Elías.
const QUIEN_EDITA = "Elías Llaury";

/** Meta permite 4 cambios por hora por conjunto de anuncios (RF-M9-07). */
const CAMBIOS_POR_HORA = 4;

/** Cuánto rinden 14 días respecto de 7. Los anuncios de hace 3 días no tienen semana anterior. */
const FACTOR_14: Record<string, number> = {
  "a-01": 1.9,
  "a-04": 2.05,
  "a-03": 2.1,
  "a-02": 1.95,
  "a-05": 2,
  "a-06": 2.2,
  "a-07": 1,
  "a-08": 1,
  "a-09": 1,
  "a-10": 0,
};

/** El anuncio legado no gastó en el período, pero tiene un pedido de un clic de hace 12 días. */
const LEGADO_14D = { pedidos: 1, ventas: 64_000, margen: 14_900 };

/** Lo que decía Byos para los mismos períodos (pegaba a la clienta a su primer anuncio). */
const PEDIDOS_SEGUN_BYOS: Record<PeriodoPauta, number> = { 7: 27, 14: 51 };

type PautaState = {
  estados: Map<string, AnuncioSeed["estado"]>;
  /** Momentos (ms) de los cambios recientes por conjunto. */
  cambios: Map<string, number[]>;
  tipoCambio: PautaConfig["tipoCambio"];
  presupuestos: Map<string, number>;
};

const getState = defineStore("pauta", (now): PautaState => ({
  estados: new Map(anuncios.map((anuncio) => [anuncio.id, anuncio.estado])),
  cambios: new Map([["Interior · revendedoras", [now - 25 * 60_000]]]),
  tipoCambio: {
    valor: TIPO_CAMBIO_USD,
    actualizadoPor: "Elías Llaury",
    actualizadoEl: isoAgo(2 * DAY + 3 * HOUR, now),
    historial: [
      { valor: TIPO_CAMBIO_USD, por: "Elías Llaury", el: isoAgo(2 * DAY + 3 * HOUR, now) },
      { valor: 1_435, por: "Elías Llaury", el: isoAgo(9 * DAY, now) },
      { valor: 1_410, por: "Leo", el: isoAgo(16 * DAY, now) },
    ],
  },
  presupuestos: new Map([
    ["amba", 380],
    ["interior", 260],
    ["captacion", 110],
    ["liquidacion", 40],
  ]),
}));

function readPeriodo(url: URL): PeriodoPauta {
  return url.searchParams.get("dias") === "14" ? 14 : 7;
}

function filaDe(
  anuncio: AnuncioSeed,
  periodo: PeriodoPauta,
  tipoCambio: number,
  estado: AnuncioSeed["estado"],
): AnuncioFila {
  const factor = periodo === 14 ? (FACTOR_14[anuncio.id] ?? 2) : 1;
  const gastoUsd = Math.round(anuncio.gastoUsd7d * factor);
  const conversaciones = Math.round(anuncio.conversaciones7d * factor);
  const legado14 = periodo === 14 && anuncio.gastoUsd7d === 0;

  let pedidos = Math.round(anuncio.pedidos7d * factor);
  let ventas = anuncio.pedidos7d > 0 ? Math.round((anuncio.ventas7d / anuncio.pedidos7d) * pedidos) : 0;
  let margen = anuncio.pedidos7d > 0 ? Math.round((anuncio.margen7d / anuncio.pedidos7d) * pedidos) : 0;
  if (legado14) ({ pedidos, ventas, margen } = LEGADO_14D);

  const gastoArs = gastoUsd * tipoCambio;
  const producto = anuncio.sku ? getProducto(anuncio.sku) : null;

  return {
    id: anuncio.id,
    nombre: anuncio.nombre,
    campana: anuncio.campana,
    conjunto: anuncio.conjunto,
    sku: anuncio.sku,
    producto: producto ? { nombre: producto.nombre, colores: producto.colores } : null,
    zona: anuncio.zona,
    formato: anuncio.formato,
    estado,
    gastoUsd,
    gastoArs,
    conversaciones,
    pedidos,
    tasaCierre: conversaciones > 0 ? pedidos / conversaciones : null,
    ventas,
    margen,
    rm: gastoArs > 0 ? margen / gastoArs : null,
    ganancia: margen - gastoArs,
    valorRecompra90d: anuncio.valorRecompra90d,
    semaforo: anuncio.semaforo,
    motivo: anuncio.motivo,
    muestraChica: gastoUsd > 0 && pedidos < 3,
    legado: gastoUsd === 0,
  };
}

function filas(periodo: PeriodoPauta) {
  const state = getState();
  return anuncios.map((anuncio) =>
    filaDe(anuncio, periodo, state.tipoCambio.valor, state.estados.get(anuncio.id) ?? anuncio.estado),
  );
}

function kpis(periodo: PeriodoPauta): Kpi[] {
  const rows = filas(periodo).filter((row) => !row.legado);
  const tipoCambio = getState().tipoCambio.valor;
  const gastoUsd = rows.reduce((sum, row) => sum + row.gastoUsd, 0);
  const gastoArs = gastoUsd * tipoCambio;
  const pedidos = rows.reduce((sum, row) => sum + row.pedidos, 0);
  const conversaciones = rows.reduce((sum, row) => sum + row.conversaciones, 0);
  const margen = rows.reduce((sum, row) => sum + row.margen, 0);

  return [
    {
      id: "gasto",
      label: `Gasto · ${periodo} días`,
      value: gastoUsd,
      format: "usd",
      hint: `${formatCurrency(gastoArs)} a ${formatCurrency(tipoCambio)} por dólar`,
    },
    {
      id: "pedidos",
      label: "Pedidos verificados",
      value: pedidos,
      format: "number",
      hint: `De ${formatNumber(conversaciones)} conversaciones de pauta`,
    },
    {
      id: "margen",
      label: "Margen atribuido",
      value: margen,
      format: "currency",
      hint: "Línea por línea, con el costo de DUX",
    },
    periodo === 7
      ? {
          id: "rm",
          label: "RM de la pauta",
          value: margen / gastoArs,
          format: "ratio",
          delta: { value: 0.21, unit: "number", period: "vs. los 7 días anteriores", positive: true },
        }
      : { id: "rm", label: "RM de la pauta", value: margen / gastoArs, format: "ratio", hint: "Equilibrio 1,00" },
    {
      id: "cierre",
      label: "Cierre de conversaciones",
      value: conversaciones > 0 ? pedidos / conversaciones : 0,
      format: "percent",
      hint: "Pedidos verificados ÷ conversaciones",
    },
  ];
}

function atribucion(periodo: PeriodoPauta): AtribucionEstado {
  const rows = filas(periodo);
  const verificados = rows.filter((row) => !row.legado);
  const atribuido = verificados.reduce((sum, row) => sum + row.ventas, 0);
  return {
    periodo,
    pedidosVerificados: verificados.reduce((sum, row) => sum + row.pedidos, 0),
    atribuido,
    facturado: atribuido,
    pedidosLegado: rows.filter((row) => row.legado).reduce((sum, row) => sum + row.pedidos, 0),
    pedidosSegunByos: PEDIDOS_SEGUN_BYOS[periodo],
  };
}

function config(now: number): PautaConfig {
  return {
    tipoCambio: getState().tipoCambio,
    conversiones: {
      estado: "activo",
      permiso: "whatsapp_business_manage_events",
      eventos7d: 18,
      deduplicados7d: 3,
      ultimoEnvio: isoAgo(12, now),
    },
  };
}

function cambiosRestantes(conjunto: string, now: number) {
  const state = getState();
  const recientes = (state.cambios.get(conjunto) ?? []).filter((at) => now - at < 60 * 60_000);
  state.cambios.set(conjunto, recientes);
  return { recientes, restantes: CAMBIOS_POR_HORA - recientes.length };
}

/* ---- Presupuesto del mes ---------------------------------------------------- */

const CAMPANAS = [
  { id: "amba", nombre: "Mensajes AMBA · contraentrega", objetivo: "Mensajes · AMBA" },
  { id: "interior", nombre: "Mensajes Interior", objetivo: "Mensajes · Interior" },
  { id: "captacion", nombre: "Captación · promo medias", objetivo: "Captación de clientas nuevas" },
  { id: "liquidacion", nombre: "Liquidación invierno", objetivo: "Liquidar stock de temporada" },
];

function hoyBA(now: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 1);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function presupuesto(now: number): PresupuestoMes {
  const state = getState();
  const { year, month, day } = hoyBA(now);
  const diasDelMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mes = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 15)),
  );

  const series = CAMPANAS.map((campana, k) => {
    const propios = anuncios.filter((anuncio) => anuncio.campana === campana.nombre);
    const porDia = propios.reduce((sum, anuncio) => sum + anuncio.gastoUsd7d, 0) / 7;
    const dias = Array.from({ length: day }, (_, index) => {
      const variacion = 0.8 + (((index + 1) * 37 + k * 11) % 10) / 25;
      // Hoy va por la mitad del día.
      const parcial = index === day - 1 ? 0.55 : 1;
      return Math.round(porDia * variacion * parcial * 100) / 100;
    });
    return { campana, propios, dias };
  });

  const campanas: CampanaPresupuesto[] = series.map(({ campana, propios, dias }) => {
    const gastadoUsd = Math.round(dias.reduce((sum, value) => sum + value, 0));
    const completos = dias.slice(0, -1);
    const promedio =
      completos.length > 0
        ? completos.reduce((sum, value) => sum + value, 0) / completos.length
        : (dias[0] ?? 0) / 0.55;
    const proyeccionUsd = Math.round(gastadoUsd + promedio * (diasDelMes - day + 0.45));
    const presupuestoUsd = state.presupuestos.get(campana.id) ?? 0;
    const gasto7d = propios.reduce((sum, anuncio) => sum + anuncio.gastoUsd7d, 0) * state.tipoCambio.valor;
    const margen7d = propios.reduce((sum, anuncio) => sum + anuncio.margen7d, 0);

    return {
      id: campana.id,
      nombre: campana.nombre,
      objetivo: campana.objetivo,
      anuncios: propios.filter((anuncio) => (state.estados.get(anuncio.id) ?? anuncio.estado) === "activo").length,
      presupuestoUsd,
      gastadoUsd,
      proyeccionUsd,
      desvio: presupuestoUsd > 0 ? (proyeccionUsd - presupuestoUsd) / presupuestoUsd : 0,
      rm: gasto7d > 0 ? margen7d / gasto7d : null,
      pedidos7d: propios.reduce((sum, anuncio) => sum + anuncio.pedidos7d, 0),
    };
  });

  const mm = String(month).padStart(2, "0");
  const gastoDiario: DailyPoint[] = Array.from({ length: day }, (_, index) => ({
    date: `${year}-${mm}-${String(index + 1).padStart(2, "0")}`,
    value: Math.round(series.reduce((sum, { dias }) => sum + (dias[index] ?? 0), 0) * 100) / 100,
  }));

  return { mes, dia: day, diasDelMes, tipoCambio: state.tipoCambio.valor, campanas, gastoDiario };
}

/* ---- Rutas ------------------------------------------------------------------ */

export const routes: Route[] = [
  { method: "GET", pattern: /^\/pauta\/kpis$/, handler: ({ url }) => Response.json(kpis(readPeriodo(url))) },
  { method: "GET", pattern: /^\/pauta\/anuncios$/, handler: ({ url }) => Response.json(filas(readPeriodo(url))) },
  {
    method: "GET",
    pattern: /^\/pauta\/atribucion$/,
    handler: ({ url }) => Response.json(atribucion(readPeriodo(url))),
  },
  { method: "GET", pattern: /^\/pauta\/config$/, handler: () => Response.json(config(Date.now())) },
  {
    method: "GET",
    pattern: /^\/pauta\/anuncios\/([^/]+)\/cambios$/,
    handler: ({ params: [id] }) => {
      const anuncio = anuncios.find((item) => item.id === decodeURIComponent(id));
      if (!anuncio) return errorResponse(404, `No existe el anuncio ${id}.`);
      const { restantes } = cambiosRestantes(anuncio.conjunto, Date.now());
      return Response.json({ conjunto: anuncio.conjunto, cambiosRestantes: restantes });
    },
  },
  {
    method: "POST",
    pattern: /^\/pauta\/anuncios\/([^/]+)\/estado$/,
    handler: async ({ params: [id], request }) => {
      const anuncio = anuncios.find((item) => item.id === decodeURIComponent(id));
      if (!anuncio) return errorResponse(404, `No existe el anuncio ${id}.`);
      const body = await readJson<{ estado: "activo" | "pausado" }>(request);
      if (body.estado !== "activo" && body.estado !== "pausado") {
        return errorResponse(400, "El estado tiene que ser activo o pausado.");
      }

      const now = Date.now();
      const { recientes, restantes } = cambiosRestantes(anuncio.conjunto, now);
      if (restantes <= 0) {
        return errorResponse(
          429,
          `Meta permite ${CAMBIOS_POR_HORA} cambios por hora en “${anuncio.conjunto}”. Probá de nuevo en un rato.`,
        );
      }
      getState().cambios.set(anuncio.conjunto, [...recientes, now]);
      getState().estados.set(anuncio.id, body.estado);
      return Response.json({ estado: body.estado, cambiosRestantes: restantes - 1 });
    },
  },
  {
    method: "PATCH",
    pattern: /^\/pauta\/tipo-cambio$/,
    handler: async ({ request }) => {
      const { valor } = await readJson<{ valor: number }>(request);
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 100 || valor > 100_000) {
        return errorResponse(400, "El tipo de cambio tiene que ser un número entre 100 y 100.000.");
      }
      const state = getState();
      const el = new Date().toISOString();
      state.tipoCambio = {
        valor,
        actualizadoPor: QUIEN_EDITA,
        actualizadoEl: el,
        historial: [{ valor, por: QUIEN_EDITA, el }, ...state.tipoCambio.historial].slice(0, 5),
      };
      return Response.json(state.tipoCambio);
    },
  },
  { method: "GET", pattern: /^\/pauta\/presupuesto$/, handler: () => Response.json(presupuesto(Date.now())) },
  {
    method: "PATCH",
    pattern: /^\/pauta\/campanas\/([^/]+)$/,
    handler: async ({ params: [id], request }) => {
      const campana = CAMPANAS.find((item) => item.id === decodeURIComponent(id));
      if (!campana) return errorResponse(404, `No existe la campaña ${id}.`);
      const { presupuestoUsd } = await readJson<{ presupuestoUsd: number }>(request);
      if (
        typeof presupuestoUsd !== "number" ||
        !Number.isFinite(presupuestoUsd) ||
        presupuestoUsd <= 0 ||
        presupuestoUsd > 100_000
      ) {
        return errorResponse(400, "El presupuesto tiene que ser un monto en dólares mayor a 0.");
      }
      getState().presupuestos.set(campana.id, Math.round(presupuestoUsd));
      const actualizada = presupuesto(Date.now()).campanas.find((item) => item.id === campana.id);
      return Response.json(actualizada);
    },
  },
];
