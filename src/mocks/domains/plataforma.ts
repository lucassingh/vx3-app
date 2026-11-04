import {
  describirValorRegla,
  validarRegla,
  type AlertaPreferencia,
  type CambioRegla,
  type CambioReglaInput,
  type CanalAlerta,
  type IaConfig,
  type IaConsumo,
  type ReglaGrupo,
  type ReglaNegocio,
  type ReglaTipo,
  type ReglaValor,
  type SeguridadCuenta,
  type SesionAbierta,
  type UsuarioEquipo,
} from "@/lib/api/contracts/plataforma";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import {
  dailySeries,
  dateAgo,
  DAY,
  equipo,
  HOUR,
  isoAgo,
  PEDIDO_MINIMO,
  ROAS_EQUILIBRIO,
  ROAS_OBJETIVO,
  TARIFAS,
  TIPO_CAMBIO_USD,
} from "../seed";

/** M0 · Plataforma: reglas, IA, usuarios, auditoría y cuenta. */

/** Usuario de la sesión (hay uno solo, ver src/lib/session.ts). */
/** La persona que usa la demo: la primera del equipo semilla. */
const YO = (() => {
  const [primera] = equipo;
  if (!primera) throw new Error("La semilla del equipo está vacía.");
  return primera;
})();
const nombreDe = (usuarioId: string) => equipo.find((u) => u.id === usuarioId)?.nombre ?? "Más Uno";

/* ---- Reglas ---------------------------------------------------------------- */

type ReglaSeed = Omit<ReglaNegocio, "vigenciaDesde" | "actualizadoPor" | "actualizadoEn"> & {
  por?: string;
  haceMin?: number;
};

const EJEMPLO_ZONAS = "Valor de ejemplo: falta la tabla de zonas y tarifas (Q-40).";
const r = (
  id: string,
  codigo: string,
  grupo: ReglaGrupo,
  nombre: string,
  descripcion: string,
  tipo: ReglaTipo,
  valor: ReglaValor,
  extra: Partial<ReglaSeed> = {},
): ReglaSeed => ({ id, codigo, grupo, nombre, descripcion, tipo, valor, ...extra });

const reglasSeed: ReglaSeed[] = [
  // Productos y precios
  r(
    "coef-prenda",
    "RN-11",
    "precios",
    "Prenda de lencería",
    "Precio piso de la prenda suelta (solo lista LOCAL) sobre el costo de la prenda.",
    "coeficiente",
    2.21,
  ),
  r(
    "coef-media-docena",
    "RN-11",
    "precios",
    "Media docena de lencería (-6)",
    "El bulto mayorista. Sobre el costo del combo; deja ~23 % de margen.",
    "coeficiente",
    1.3,
  ),
  r(
    "coef-docena",
    "RN-11",
    "precios",
    "Docena de lencería (-12)",
    "Pack opcional para los productos de gran volumen.",
    "coeficiente",
    1.1765,
  ),
  r(
    "coef-medias-3",
    "RN-12",
    "precios",
    "Pack de 3 medias",
    "Pack minorista, solo en la lista LOCAL.",
    "coeficiente",
    2.21,
  ),
  r(
    "coef-medias-6",
    "RN-12",
    "precios",
    "Pack de 6 medias",
    "Pack minorista: no se vende por WhatsApp.",
    "coeficiente",
    1.8182,
  ),
  r(
    "coef-medias-12",
    "RN-12",
    "precios",
    "Docena de medias (-12)",
    "El bulto mayorista de medias.",
    "coeficiente",
    1.3,
  ),
  r(
    "coef-medias-24",
    "RN-12",
    "precios",
    "Dos docenas de medias (-24)",
    "Pack opcional para los productos de gran volumen.",
    "coeficiente",
    1.1765,
  ),
  r(
    "redondeo",
    "RN-13",
    "precios",
    "Redondeo de precios",
    "Todos los precios se redondean hacia arriba a este múltiplo.",
    "seleccion",
    "100",
    {
      opciones: [
        { value: "100", label: "$ 100" },
        { value: "500", label: "$ 500" },
        { value: "1000", label: "$ 1.000" },
      ],
    },
  ),
  r(
    "costo-baja",
    "RN-17",
    "precios",
    "Mantener el precio si el costo baja",
    "Se mantiene mientras se vende el stock que entró al costo anterior, y avisa cuando se agota.",
    "booleano",
    true,
  ),
  r(
    "control-margen",
    "RN-18",
    "precios",
    "Control de margen",
    "Cuándo se listan los productos por debajo del piso.",
    "seleccion",
    "diario",
    {
      opciones: [
        { value: "diario", label: "Todos los días" },
        { value: "lunes", label: "Los lunes y al cerrar cada compra" },
      ],
      por: "u-elias",
      haceMin: 4 * DAY,
    },
  ),
  r(
    "coef-combo",
    "RN-19",
    "precios",
    "Precio mínimo de un combo armado",
    "Sobre el costo del combo. COMBO1 es una excepción a propósito.",
    "coeficiente",
    1.3,
  ),
  r(
    "combos-desde",
    "RN-108",
    "precios",
    "Combos sugeridos: total desde",
    "Rango de precio de los combos de 4 a 6 bultos que propone el generador.",
    "moneda",
    45_000,
  ),
  r(
    "combos-hasta",
    "RN-108",
    "precios",
    "Combos sugeridos: total hasta",
    "Tope del rango del generador de combos.",
    "moneda",
    60_000,
  ),
  r(
    "combos-margen",
    "RN-108",
    "precios",
    "Aviso de margen bajo en un combo",
    "El generador avisa, sin bloquear, si el margen del combo queda por debajo.",
    "porcentaje",
    10,
  ),
  // Pedidos y facturación
  r(
    "minimo",
    "RN-20",
    "pedidos",
    "Pedido mínimo sin envío",
    "El bot y la vidriera dicen cuánto falta y piden un complementario solo por la diferencia.",
    "moneda",
    PEDIDO_MINIMO,
  ),
  r(
    "diferencial",
    "RN-20",
    "pedidos",
    "Tarifa diferencial bajo el mínimo",
    "Si la clienta no completa el mínimo. El monto está por definir con Elías (Q-90).",
    "moneda",
    null,
    { aConfirmar: true },
  ),
  r("sena", "RN-28", "pedidos", "Seña para retirar en el local", "Sobre el total del pedido.", "porcentaje", 10),
  r(
    "comprobante",
    "RN-23",
    "pedidos",
    "Comprobante si ya pagó por transferencia",
    "Si no pagó, va comprobante de venta.",
    "seleccion",
    "factura",
    {
      opciones: [
        { value: "factura", label: "Factura" },
        { value: "cv", label: "Comprobante de venta" },
      ],
    },
  ),
  r(
    "punto-venta",
    "RN-24",
    "pedidos",
    "Punto de venta",
    "El que usa la facturación por API.",
    "texto",
    "2 - MONOTRIBUTO ELIAS",
  ),
  r(
    "lista",
    "RN-24",
    "pedidos",
    "Lista de precios mayorista",
    "La que usan el bot, la vidriera y la factura.",
    "seleccion",
    "mayorista",
    {
      opciones: [
        { value: "mayorista", label: "MAYORISTA EF/TR" },
        { value: "local", label: "LOCAL EF/TR" },
      ],
    },
  ),
  // Envíos
  r(
    "envio1",
    "RN-26",
    "envios",
    "ENVIO1 · mensajería zona 1",
    "Se suma a la factura de los pedidos de AMBA zona 1.",
    "moneda",
    TARIFAS.envio1,
    { nota: EJEMPLO_ZONAS },
  ),
  r(
    "envio2",
    "RN-26",
    "envios",
    "ENVIO2 · mensajería zona 2",
    "Se suma a la factura de los pedidos de AMBA zona 2.",
    "moneda",
    TARIFAS.envio2,
    { nota: EJEMPLO_ZONAS },
  ),
  r(
    "embalaje1",
    "RN-26",
    "envios",
    "EMBALAJE1 · mensajería",
    "Embalaje de los envíos por mensajería.",
    "moneda",
    TARIFAS.embalaje1,
  ),
  r(
    "embalaje2",
    "RN-26",
    "envios",
    "EMBALAJE2 · Correo y transportes",
    "Correo, Vía Cargo, Buspack e Integral Pack.",
    "moneda",
    TARIFAS.embalaje2,
  ),
  r(
    "despacho-hoy",
    "RN-80",
    "envios",
    "Despacho AMBA en el día si se cierra antes de",
    "Activa la palanca “sale hoy” del bot.",
    "hora",
    "11:00",
  ),
  r(
    "corte-mensajeria",
    "RN-80",
    "envios",
    "Corte de etiquetas de mensajería",
    "Hasta esta hora se suben los envíos del día a Zupply.",
    "hora",
    "12:00",
  ),
  r("corte-via-cargo", "RN-80", "envios", "Corte de Vía Cargo", "", "hora", "17:30"),
  r("corte-correo", "RN-80", "envios", "Corte del Correo", "", "hora", "18:30"),
  r(
    "peso-bulto",
    "RF-M6-01",
    "envios",
    "Peso máximo por bulto del Correo",
    "El cotizador parte el pedido en bultos de hasta este peso y 150 cm.",
    "numero",
    25,
    { unidad: "kg", min: 1, max: 30 },
  ),
  // Cobros
  r(
    "sla-cobro",
    "RN-40",
    "cobros",
    "Cargar cada pago dentro de",
    "Desde que entró al banco. Pasado ese plazo, alerta.",
    "numero",
    24,
    { unidad: "horas", min: 1, max: 72 },
  ),
  r(
    "cobro-viejo",
    "RN-44",
    "cobros",
    "Un cobro pendiente es viejo a los",
    "Va al corte semanal con la mensajería.",
    "numero",
    2,
    { unidad: "días", min: 1, max: 15, por: "u-leo", haceMin: 6 * DAY },
  ),
  r(
    "tolerancia-fecha",
    "RF-M7-03",
    "cobros",
    "Tolerancia de fecha para proponer un cruce",
    "Entre la transferencia y el pedido, hacia los dos lados.",
    "numero",
    2,
    { unidad: "días", min: 0, max: 7 },
  ),
  r(
    "corte-semanal",
    "RN-45",
    "cobros",
    "Ventana del corte semanal de contraentrega",
    "Cruce de DUX, Zupply y los cuatro bancos para el reclamo a Transtech.",
    "seleccion",
    "lun-sab",
    {
      opciones: [
        { value: "lun-sab", label: "Lunes a sábado" },
        { value: "sab-sab", label: "Sábado a sábado" },
      ],
      por: "u-elias",
      haceMin: 2 * DAY + 3 * HOUR,
    },
  ),
  // Post-venta
  r(
    "sla-reclamo",
    "RN-50",
    "postventa",
    "Responder un reclamo en",
    "Pasado el plazo, alerta a Lucía y a Elías.",
    "numero",
    24,
    { unidad: "horas", min: 1, max: 72, por: "u-lucia", haceMin: 9 * DAY },
  ),
  r(
    "evidencia-pedido",
    "RN-52",
    "postventa",
    "Sin video de apertura si el pedido supera",
    "Excepción a la evidencia: compras grandes.",
    "moneda",
    100_000,
  ),
  r(
    "evidencia-30d",
    "RN-52",
    "postventa",
    "…o si compró en los últimos 30 días más de",
    "Excepción a la evidencia: clientas frecuentes.",
    "moneda",
    150_000,
  ),
  r(
    "tipo3",
    "RN-56",
    "postventa",
    "Producto equivocado: se lo queda sin pagar la diferencia si es menor a",
    "Cuando la diferencia es a favor de la clienta.",
    "moneda",
    5_000,
  ),
  r(
    "origenes",
    "RN-62",
    "postventa",
    "Orígenes probables de un reclamo",
    "Lista cerrada. El origen nunca queda vacío.",
    "texto",
    "Armado, proveedor, envío, catálogo, bot, sin determinar",
  ),
  // Bot y recuperación
  r(
    "seguimiento-1",
    "RN-70",
    "bot",
    "Primer mensaje a un pedido sin respuesta",
    "Si hay una pregunta sin responder, primero se responde eso.",
    "numero",
    30,
    { unidad: "min", min: 5, max: 240 },
  ),
  r(
    "seguimiento-2",
    "RN-73",
    "bot",
    "Segundo mensaje",
    "Con otra palanca: nunca el mismo texto.",
    "seleccion",
    "tarde",
    {
      opciones: [
        { value: "tarde", label: "Esa misma tarde" },
        { value: "3h", label: "A las 3 horas" },
      ],
    },
  ),
  r(
    "seguimiento-3",
    "RN-73",
    "bot",
    "Tercer mensaje",
    "Después del tercero no se insiste (RN-76).",
    "seleccion",
    "manana",
    {
      opciones: [
        { value: "manana", label: "A la mañana siguiente" },
        { value: "mediodia", label: "Al mediodía siguiente" },
      ],
    },
  ),
  r(
    "anular",
    "RN-73",
    "bot",
    "Anular el pedido y liberar el stock a las",
    "Sin respuesta desde el último mensaje de la clienta.",
    "numero",
    24,
    { unidad: "horas", min: 6, max: 72, por: "u-masuno", haceMin: 3 * DAY },
  ),
  r(
    "derivar-monto",
    "RF-M3-06",
    "bot",
    "Derivar a una persona los pedidos de más de",
    "Pedidos grandes: los cierra alguien del equipo.",
    "moneda",
    250_000,
  ),
  // Pauta
  r(
    "tipo-cambio",
    "RN-111",
    "pauta",
    "Tipo de cambio del gasto de Meta",
    "Pesos por dólar. El gasto de Meta llega en USD.",
    "moneda",
    TIPO_CAMBIO_USD,
    { por: "u-elias", haceMin: 2 * DAY },
  ),
  r(
    "roas-equilibrio",
    "RN-111",
    "pauta",
    "ROAS de equilibrio",
    "Equivale a ~23 % de margen, coherente con RM 1.",
    "coeficiente",
    ROAS_EQUILIBRIO,
  ),
  r(
    "roas-objetivo",
    "RN-111",
    "pauta",
    "ROAS objetivo",
    "Referencia verde del semáforo.",
    "coeficiente",
    ROAS_OBJETIVO,
  ),
  r(
    "muestra-chica",
    "RN-111",
    "pauta",
    "Muestra chica con menos de",
    "Por debajo, el semáforo no recomienda escalar ni apagar.",
    "numero",
    3,
    { unidad: "pedidos", min: 1, max: 20 },
  ),
  r(
    "ventana-atribucion",
    "RN-110",
    "pauta",
    "Ventana de atribución (último clic)",
    "Un clic que ya terminó en compra no se reutiliza.",
    "numero",
    30,
    { unidad: "días", min: 1, max: 90 },
  ),
];

const historialSeed: (Omit<CambioRegla, "en"> & { haceMin: number })[] = [
  {
    id: "cr-6",
    reglaId: "tipo-cambio",
    codigo: "RN-111",
    nombre: "Tipo de cambio del gasto de Meta",
    antes: "$ 1.420",
    despues: "$ 1.450",
    por: "Elías Llaury",
    haceMin: 2 * DAY,
  },
  {
    id: "cr-5",
    reglaId: "corte-semanal",
    codigo: "RN-45",
    nombre: "Ventana del corte semanal de contraentrega",
    antes: "Sábado a sábado",
    despues: "Lunes a sábado",
    por: "Elías Llaury",
    haceMin: 2 * DAY + 3 * HOUR,
  },
  {
    id: "cr-4",
    reglaId: "anular",
    codigo: "RN-73",
    nombre: "Anular el pedido y liberar el stock a las",
    antes: "18 horas",
    despues: "24 horas",
    por: "Más Uno",
    haceMin: 3 * DAY,
  },
  {
    id: "cr-3",
    reglaId: "control-margen",
    codigo: "RN-18",
    nombre: "Control de margen",
    antes: "Los lunes y al cerrar cada compra",
    despues: "Todos los días",
    por: "Elías Llaury",
    haceMin: 4 * DAY,
  },
  {
    id: "cr-2",
    reglaId: "cobro-viejo",
    codigo: "RN-44",
    nombre: "Un cobro pendiente es viejo a los",
    antes: "3 días",
    despues: "2 días",
    por: "Leo",
    haceMin: 6 * DAY,
  },
  {
    id: "cr-1",
    reglaId: "sla-reclamo",
    codigo: "RN-50",
    nombre: "Responder un reclamo en",
    antes: "48 horas",
    despues: "24 horas",
    por: "Lucía",
    haceMin: 9 * DAY,
  },
];

const CARGA_INICIAL_MIN = 10 * DAY;

/* ---- IA -------------------------------------------------------------------- */

/** Gasto diario del bot en centavos de dólar; el último es hoy, hasta ahora. */
const GASTO_IA_CENTAVOS = [
  78, 84, 71, 90, 95, 80, 46, 88, 82, 79, 91, 97, 85, 44, 93, 86, 83, 92, 99, 87, 48, 96, 89, 84, 94, 101, 90, 52, 98,
  41,
];

const CASOS_IA: [string, string, number][] = [
  ["consulta", "Consulta de producto (anuncio o pregunta abierta)", 0.455],
  ["cierre", "Cierre: carrito, envío y pago", 0.25],
  ["recuperacion", "Recuperación de pedidos trabados", 0.105],
  ["estado", "Estado del pedido", 0.1],
  ["reclamo", "Reclamo y derivación", 0.055],
  ["comprobante", "Lectura de comprobantes", 0.035],
];

function consumoIa(now: number): IaConsumo {
  const diario = dailySeries(
    GASTO_IA_CENTAVOS.map((centavos) => centavos / 100),
    now,
  );
  const costo = diario.reduce((sum, punto) => sum + punto.value, 0);
  const conversaciones = 5_910;
  const semana = diario.slice(-8, -1).reduce((sum, punto) => sum + punto.value, 0);
  return {
    costo30dUsd: Math.round(costo * 100) / 100,
    proyeccionMesUsd: Math.round((semana / 7) * 30 * 100) / 100,
    conversaciones30d: conversaciones,
    costoPorConversacionUsd: costo / conversaciones,
    tokens30d: 603_400_000,
    pctCache: 0.82,
    diario,
    porCaso: CASOS_IA.map(([id, label, share]) => ({ id, label, value: Math.round(costo * share * 100) / 100 })),
  };
}

/* ---- Usuarios y auditoría -------------------------------------------------- */

// Los roles y la matriz de permisos son reales: src/modules/platform/permissions.ts.

const accesosSeed: Record<string, { haceMin: number | null; dosFactores: boolean }> = {
  "u-elias": { haceMin: 0, dosFactores: false },
  "u-leo": { haceMin: 12, dosFactores: true },
  "u-lucia": { haceMin: 35, dosFactores: false },
  "u-juan": { haceMin: 3 * HOUR + 10, dosFactores: false },
  "u-masuno": { haceMin: 2 * DAY, dosFactores: true },
};

/* ---- Preferencias y cuenta ------------------------------------------------- */

const pref = (
  id: string,
  nombre: string,
  descripcion: string,
  app: boolean,
  whatsapp: boolean,
  mail: boolean,
): AlertaPreferencia => ({
  id,
  nombre,
  descripcion,
  canales: { app, whatsapp, mail },
});

const preferenciasSeed: AlertaPreferencia[] = [
  pref(
    "margen",
    "Margen bajo el piso",
    "Un producto quedó por debajo de su coeficiente después de un cambio de costo.",
    true,
    true,
    false,
  ),
  pref("trabado", "Pedido trabado", "Un pedido lleva más de 2 horas sin avanzar.", true, false, false),
  pref(
    "cobro",
    "Cobro viejo",
    "Una transferencia sin cargar a las 24 h o un cobro pendiente de más de 2 días.",
    true,
    false,
    true,
  ),
  pref(
    "envio",
    "Desvío en un envío",
    "Lo que cobró el transportista se aleja más de un 10 % de lo cotizado.",
    true,
    false,
    true,
  ),
  pref("anuncio", "Anuncio que gasta sin vender", "Gastó más de US$ 10 en 3 días con 0 pedidos.", true, true, false),
  pref("sync", "Sincronización caída", "DUX, Meta, WhatsApp u otra integración dejó de responder.", true, true, true),
];

/* ---- Estado ---------------------------------------------------------------- */

const getState = defineStore("plataforma", (now) => {
  const historial: CambioRegla[] = historialSeed.map(({ haceMin, ...cambio }) => ({
    ...cambio,
    en: isoAgo(haceMin, now),
  }));
  const reglas: ReglaNegocio[] = reglasSeed.map(({ por, haceMin, ...regla }) => {
    const minutos = haceMin ?? CARGA_INICIAL_MIN;
    return {
      ...regla,
      vigenciaDesde: dateAgo(Math.floor(minutos / DAY), now),
      actualizadoPor: por ? nombreDe(por) : "Más Uno",
      actualizadoEn: isoAgo(minutos, now),
    };
  });

  const usuarios: UsuarioEquipo[] = equipo.map((usuario) => {
    const acceso = accesosSeed[usuario.id];
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email ?? null,
      rol: usuario.rol,
      puesto: usuario.puesto,
      ultimoAcceso: acceso?.haceMin === null || acceso === undefined ? null : isoAgo(acceso.haceMin, now),
      dosFactores: acceso?.dosFactores ?? false,
      estado: "activo",
    };
  });

  const ia: IaConfig = {
    apiKey: { mascara: "sk-ant-••••Hq4w", cargadaPor: "Elías Llaury", cargadaEn: isoAgo(5 * DAY, now) },
    adminKey: null,
    modelo: "claude-haiku-5-5",
    modelos: [
      {
        id: "claude-haiku-5-5",
        nombre: "Claude Haiku 5.5",
        descripcion: "Rápido y económico. Con el que arranca la evaluación del bot.",
        costoMesUsd: 25,
      },
      {
        id: "claude-sonnet-5-5",
        nombre: "Claude Sonnet 5.5",
        descripcion: "Más criterio en conversaciones largas o ambiguas.",
        costoMesUsd: 520,
      },
      {
        id: "claude-opus-5-5",
        nombre: "Claude Opus 5.5",
        descripcion: "El más capaz. Para casos puntuales que el resto no resuelve.",
        costoMesUsd: 940,
      },
    ],
    topeMensualUsd: 60,
    alertaPct: 0.8,
  };

  const sesiones: SesionAbierta[] = [
    {
      id: "s-1",
      dispositivo: "Computadora con Windows",
      navegador: "Chrome",
      ubicacion: "Buenos Aires",
      ultimaActividad: isoAgo(0, now),
      actual: true,
    },
    {
      id: "s-2",
      dispositivo: "iPhone",
      navegador: "Safari · app instalada",
      ubicacion: "Buenos Aires",
      ultimaActividad: isoAgo(2 * HOUR, now),
      actual: false,
    },
    {
      id: "s-3",
      dispositivo: "PC del local",
      navegador: "Chrome",
      ubicacion: "Local de VX3",
      ultimaActividad: isoAgo(DAY + 3 * HOUR, now),
      actual: false,
    },
  ];

  const seguridad: SeguridadCuenta = { dosFactores: false, passwordActualizada: isoAgo(24 * DAY, now) };

  return {
    reglas,
    historial,
    ia,
    consumo: consumoIa(now),
    usuarios,
    preferencias: structuredClone(preferenciasSeed),
    sesiones,
    seguridad,
    secuencia: 100,
  };
});

function nextId(prefix: string) {
  const state = getState();
  state.secuencia += 1;
  return `${prefix}-${state.secuencia}`;
}

const byNewest = <T extends { en: string }>(rows: T[]) => rows.toSorted((a, b) => b.en.localeCompare(a.en));

/* ---- Rutas ----------------------------------------------------------------- */

export const routes: Route[] = [
  { method: "GET", pattern: /^\/plataforma\/reglas$/, handler: () => Response.json(getState().reglas) },
  {
    method: "GET",
    pattern: /^\/plataforma\/reglas\/historial$/,
    handler: () => Response.json(byNewest(getState().historial)),
  },
  {
    method: "PATCH",
    pattern: /^\/plataforma\/reglas$/,
    handler: async ({ request }) => {
      const { cambios = [] } = await readJson<{ cambios: CambioReglaInput[] }>(request);
      const state = getState();

      for (const cambio of cambios) {
        const regla = state.reglas.find((item) => item.id === cambio.id);
        if (!regla) return errorResponse(404, `No existe la regla ${cambio.id}.`);
        const error = validarRegla(regla, cambio.valor);
        if (error) return errorResponse(422, `${regla.nombre}: ${error}`);
      }

      const now = new Date().toISOString();
      const nuevos: CambioRegla[] = [];
      for (const cambio of cambios) {
        const regla = state.reglas.find((item) => item.id === cambio.id)!;
        const antes = describirValorRegla(regla, regla.valor);
        const despues = describirValorRegla(regla, cambio.valor);
        if (antes === despues) continue;

        regla.valor = cambio.valor;
        regla.actualizadoPor = YO.nombre;
        regla.actualizadoEn = now;
        regla.vigenciaDesde = now.slice(0, 10);
        const registro = {
          id: nextId("cr"),
          reglaId: regla.id,
          codigo: regla.codigo,
          nombre: regla.nombre,
          antes,
          despues,
          por: YO.nombre,
          en: now,
        };
        state.historial.unshift(registro);
        nuevos.push(registro);
      }
      return Response.json({ reglas: state.reglas, cambios: nuevos });
    },
  },
  { method: "GET", pattern: /^\/plataforma\/ia$/, handler: () => Response.json(getState().ia) },
  { method: "GET", pattern: /^\/plataforma\/ia\/consumo$/, handler: () => Response.json(getState().consumo) },
  {
    method: "PATCH",
    pattern: /^\/plataforma\/ia$/,
    handler: async ({ request }) => {
      const body = await readJson<Pick<IaConfig, "modelo" | "topeMensualUsd" | "alertaPct">>(request);
      const { ia } = getState();
      if (body.modelo !== undefined) {
        const modelo = ia.modelos.find((item) => item.id === body.modelo);
        if (!modelo) return errorResponse(422, "Ese modelo no está disponible.");
        if (modelo.id !== ia.modelo) {
          ia.modelo = modelo.id;
        }
      }
      if (body.topeMensualUsd !== undefined) {
        if (!(body.topeMensualUsd > 0)) return errorResponse(422, "El tope tiene que ser mayor a cero.");
        ia.topeMensualUsd = body.topeMensualUsd;
      }
      if (body.alertaPct !== undefined) {
        if (body.alertaPct < 0.5 || body.alertaPct > 1)
          return errorResponse(422, "La alerta va entre el 50 y el 100 % del tope.");
        ia.alertaPct = body.alertaPct;
      }
      return Response.json(ia);
    },
  },
  {
    method: "POST",
    pattern: /^\/plataforma\/ia\/keys$/,
    handler: async ({ request }) => {
      const { tipo, key = "" } = await readJson<{ tipo: "api" | "admin"; key: string }>(request);
      const prefix = tipo === "admin" ? "sk-ant-admin" : "sk-ant-";
      if (!key.startsWith(prefix) || key.length < 24) {
        return errorResponse(422, `La key tiene que empezar con ${prefix} y estar completa.`);
      }
      const credencial = {
        mascara: `${prefix}••••${key.slice(-4)}`,
        cargadaPor: YO.nombre,
        cargadaEn: new Date().toISOString(),
      };
      const { ia } = getState();
      if (tipo === "admin") ia.adminKey = credencial;
      else ia.apiKey = credencial;
      return Response.json(credencial);
    },
  },
  { method: "GET", pattern: /^\/plataforma\/preferencias$/, handler: () => Response.json(getState().preferencias) },
  {
    method: "PUT",
    pattern: /^\/plataforma\/preferencias$/,
    handler: async ({ request }) => {
      const { preferencias = [] } = await readJson<{ preferencias: AlertaPreferencia[] }>(request);
      const state = getState();
      const canales: CanalAlerta[] = ["app", "whatsapp", "mail"];
      state.preferencias = state.preferencias.map((actual) => {
        const nueva = preferencias.find((item) => item.id === actual.id);
        if (!nueva) return actual;
        return {
          ...actual,
          canales: Object.fromEntries(
            canales.map((canal) => [canal, Boolean(nueva.canales?.[canal])]),
          ) as AlertaPreferencia["canales"],
        };
      });
      return Response.json(state.preferencias);
    },
  },
  { method: "GET", pattern: /^\/plataforma\/perfil\/seguridad$/, handler: () => Response.json(getState().seguridad) },
  { method: "GET", pattern: /^\/plataforma\/perfil\/sesiones$/, handler: () => Response.json(getState().sesiones) },
  {
    method: "POST",
    pattern: /^\/plataforma\/perfil\/sesiones\/([^/]+)\/cerrar$/,
    handler: ({ params: [id] }) => {
      const state = getState();
      const sesion = state.sesiones.find((item) => item.id === decodeURIComponent(id));
      if (!sesion) return errorResponse(404, "Esa sesión ya no está abierta.");
      if (sesion.actual) return errorResponse(400, "Para cerrar esta sesión usá “Cerrar sesión”.");
      state.sesiones = state.sesiones.filter((item) => item.id !== sesion.id);
      return Response.json({ ok: true });
    },
  },
  {
    method: "PATCH",
    pattern: /^\/plataforma\/perfil\/dos-factores$/,
    handler: async ({ request }) => {
      const { activado } = await readJson<{ activado: boolean }>(request);
      const state = getState();
      state.seguridad.dosFactores = Boolean(activado);
      const yo = state.usuarios.find((usuario) => usuario.id === YO.id);
      if (yo) yo.dosFactores = Boolean(activado);
      return Response.json(state.seguridad);
    },
  },
  {
    method: "POST",
    pattern: /^\/plataforma\/perfil\/password$/,
    handler: async ({ request }) => {
      const { actual = "", nueva = "" } = await readJson<{ actual: string; nueva: string }>(request);
      if (!actual) return errorResponse(422, "Ingresá tu contraseña actual.");
      if (nueva.length < 10 || !/\d/.test(nueva)) {
        return errorResponse(422, "La nueva contraseña necesita al menos 10 caracteres y un número.");
      }
      if (nueva === actual) return errorResponse(422, "La nueva contraseña tiene que ser distinta de la actual.");
      const state = getState();
      state.seguridad.passwordActualizada = new Date().toISOString();
      return Response.json(state.seguridad);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/plataforma\/perfil\/datos$/,
    handler: async ({ request }) => {
      const { nombre = "" } = await readJson<{ nombre: string; telefono: string }>(request);
      if (!nombre.trim()) return errorResponse(422, "El nombre no puede quedar vacío.");
      return Response.json({ ok: true });
    },
  },
];
