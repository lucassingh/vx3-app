import type { Kpi, OrigenReclamo, PostventaResumen, ReclamoPostventa, TipoReclamo } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import { clientaRef, DAY, detalleDe, getPedido, getProducto, HOUR, isoAgo, pedidos, presentacionesDe } from "../seed";

/** M8 · Post-venta (RN-50 a RN-63). */

export const TIPOS_RECLAMO: Record<TipoReclamo, string> = {
  1: "Falta mercadería",
  2: "Mal estado",
  3: "Producto equivocado",
  4: "No era lo esperado",
  5: "Demora de mensajería",
  6: "Mal enviado por Correo",
};

export const ORIGENES_RECLAMO: { id: OrigenReclamo; label: string }[] = [
  { id: "armado", label: "Armado" },
  { id: "proveedor", label: "Proveedor" },
  { id: "envio", label: "Envío" },
  { id: "catalogo", label: "Catálogo" },
  { id: "bot", label: "Bot (Clara)" },
  { id: "sin_determinar", label: "Sin determinar" },
];

const SLA_HORAS = 24;
const EXCEPCION_PEDIDO = 100_000;
const EXCEPCION_30D = 150_000;

type ReclamoSeed = {
  id: string;
  pedidoId: string;
  tipo: TipoReclamo;
  sku: string;
  /** Prendas afectadas (tipo 1 y 2). */
  prendas: number;
  relato: string;
  creadoHaceMin: number;
  estado: ReclamoPostventa["estado"];
  recibida: string[];
  origen: OrigenReclamo | null;
  origenSugerido: OrigenReclamo;
  /** Para el tipo 3: lo que llegó en lugar de lo pedido. */
  llego?: string;
};

const RECLAMOS: ReclamoSeed[] = [
  {
    id: "R-0231",
    pedidoId: "V-1042",
    tipo: 1,
    sku: "LN35",
    prendas: 1,
    relato: "Me llegaron 5 less en la media docena en vez de 6.",
    creadoHaceMin: 22 * HOUR,
    estado: "abierto",
    recibida: ["Video de apertura"],
    origen: null,
    origenSugerido: "armado",
  },
  {
    id: "R-0230",
    pedidoId: "V-1045",
    tipo: 2,
    sku: "CJATN14",
    prendas: 1,
    relato: "Un conjunto vino con una mancha chica en la copa.",
    creadoHaceMin: 6 * HOUR,
    estado: "abierto",
    recibida: ["Foto de la falla"],
    origen: null,
    origenSugerido: "proveedor",
  },
  {
    id: "R-0229",
    pedidoId: "V-1038",
    tipo: 6,
    sku: "VN16",
    prendas: 0,
    relato: "El Correo dice que la dirección no existe y el paquete está en la sucursal.",
    creadoHaceMin: 30 * HOUR,
    estado: "abierto",
    recibida: [],
    origen: "envio",
    origenSugerido: "envio",
  },
  {
    id: "R-0228",
    pedidoId: "V-1037",
    tipo: 3,
    sku: "VN31",
    prendas: 0,
    relato: "Pedí vedetinas Need Feel y me llegó media docena de vedetinas Sakura.",
    creadoHaceMin: 10 * HOUR,
    estado: "esperando_evidencia",
    recibida: [],
    origen: null,
    origenSugerido: "armado",
    llego: "VN25",
  },
  {
    id: "R-0227",
    pedidoId: "V-1044",
    tipo: 5,
    sku: "VN14",
    prendas: 0,
    relato: "Me dijeron que llegaba ayer y todavía no tengo nada.",
    creadoHaceMin: 3 * HOUR,
    estado: "abierto",
    recibida: [],
    origen: "envio",
    origenSugerido: "envio",
  },
  {
    id: "R-0226",
    pedidoId: "V-1039",
    tipo: 4,
    sku: "BCN2",
    prendas: 0,
    relato: "El body es más transparente de lo que se veía en la foto.",
    creadoHaceMin: 2 * DAY,
    estado: "resuelto",
    recibida: ["Foto del producto"],
    origen: "catalogo",
    origenSugerido: "catalogo",
  },
  {
    id: "R-0225",
    pedidoId: "V-1036",
    tipo: 1,
    sku: "LN35",
    prendas: 2,
    relato: "Faltan dos less de la media docena.",
    creadoHaceMin: 5 * DAY,
    estado: "resuelto",
    recibida: ["Video de apertura"],
    origen: "armado",
    origenSugerido: "armado",
  },
  {
    id: "R-0224",
    pedidoId: "V-1035",
    tipo: 1,
    sku: "CAN9",
    prendas: 1,
    relato: "Vinieron cinco corpiños en lugar de seis.",
    creadoHaceMin: 6 * DAY,
    estado: "resuelto",
    recibida: ["Video de apertura"],
    origen: "armado",
    origenSugerido: "armado",
  },
  {
    id: "R-0223",
    pedidoId: "V-1043",
    tipo: 2,
    sku: "CJATN14",
    prendas: 1,
    relato: "Se descosió un bretel al probarlo.",
    creadoHaceMin: 2 * DAY + 5 * HOUR,
    estado: "resuelto",
    recibida: ["Video de apertura", "Foto de la falla"],
    origen: "proveedor",
    origenSugerido: "proveedor",
  },
];

const getPostventaDb = defineStore("postventa", (now) => ({
  now,
  cambios: new Map<string, { estado: ReclamoPostventa["estado"]; origen: OrigenReclamo }>(),
}));

/** Compras de la clienta en los últimos 30 días, para la excepción del video (RN-52). */
function compra30d(clientaId: string) {
  return pedidos
    .filter(
      (pedido) => pedido.clientaId === clientaId && pedido.estado !== "anulado" && pedido.creadoHaceMin < 30 * DAY,
    )
    .reduce((sum, pedido) => sum + detalleDe(pedido).total, 0);
}

function resolucionDe(seed: ReclamoSeed) {
  const producto = getProducto(seed.sku);
  const { bulto } = presentacionesDe(producto);
  const divisor = bulto.prendas;
  const prenda = Math.round(bulto.precio / divisor);
  const calculoPrenda = `${bulto.codigo} ${formatCurrency(bulto.precio)} ÷ ${divisor} = ${formatCurrency(prenda)} por prenda (RN-60)`;

  switch (seed.tipo) {
    case 1:
      return {
        sugerida: "Reintegro del valor del faltante. Nunca se reenvía (RN-54).",
        monto: prenda * seed.prendas,
        calculo: `${seed.prendas} × ${calculoPrenda}`,
      };
    case 2: {
      const costo = Math.round(bulto.costo / divisor);
      return {
        sugerida:
          "Si la mancha es chica y lavable, ofrecer que se la quede a precio de costo; si no, reintegro (RN-55).",
        monto: prenda - costo,
        calculo: `${calculoPrenda} · a costo ${formatCurrency(costo)} → reintegro ${formatCurrency(prenda - costo)}`,
      };
    }
    case 3: {
      const llego = presentacionesDe(getProducto(seed.llego!)).bulto;
      const diferencia = bulto.precio - llego.precio;
      return {
        sugerida:
          diferencia > 0
            ? "Preguntarle si le sirve. La diferencia es en contra de la clienta: se le devuelve (RN-56)."
            : "Preguntarle si le sirve. Si la diferencia a su favor es menor a $ 5.000, se lo queda sin pagarla (RN-56).",
        monto: Math.max(0, diferencia),
        calculo: `${bulto.codigo} ${formatCurrency(bulto.precio)} − ${llego.codigo} ${formatCurrency(llego.precio)}`,
      };
    }
    case 4:
      return {
        sugerida: "Mandarle la captura del catálogo: no hay cambio (RN-57).",
        monto: 0,
        calculo: "Sin reintegro",
      };
    case 5:
      return {
        sugerida: "Buscar el envío en Zupply, consultar a Transtech y avisarle cuando se resuelva (RN-58).",
        monto: 0,
        calculo: "Sin reintegro mientras el paquete esté en camino",
      };
    case 6:
      return {
        sugerida: "Buscarlo en MiCorreo, mandar el mail a soporte y contener a la clienta (RN-59).",
        monto: 0,
        calculo: "Sin reintegro hasta que responda el Correo",
      };
  }
}

/** Reclamos de los últimos 7 días, con el monto a reintegrar: los usa el Inicio (P-15). */
export function reclamosSemana() {
  const semana = RECLAMOS.filter((seed) => seed.creadoHaceMin < 7 * DAY);
  const porTipo = new Map<TipoReclamo, number>();
  for (const seed of semana) porTipo.set(seed.tipo, (porTipo.get(seed.tipo) ?? 0) + 1);
  const [masFrecuente] = [...porTipo].toSorted((a, b) => b[1] - a[1]);
  return {
    cantidad: semana.length,
    monto: semana.reduce((sum, seed) => sum + resolucionDe(seed).monto, 0),
    masFrecuente: masFrecuente ? { label: TIPOS_RECLAMO[masFrecuente[0]], cantidad: masFrecuente[1] } : null,
  };
}

function toReclamo(seed: ReclamoSeed, now: number): ReclamoPostventa {
  const db = getPostventaDb();
  const cambio = db.cambios.get(seed.id);
  const pedido = getPedido(seed.pedidoId);
  const producto = getProducto(seed.sku);
  const compraPedido = detalleDe(pedido).total;
  const compraMes = compra30d(pedido.clientaId);
  const minutos = seed.creadoHaceMin + Math.round((now - db.now) / 60_000);

  const conProducto = seed.tipo <= 3;
  const excepcion =
    compraPedido > EXCEPCION_PEDIDO
      ? `Compró ${formatCurrency(compraPedido)} en este pedido (más de ${formatCurrency(EXCEPCION_PEDIDO)})`
      : compraMes > EXCEPCION_30D
        ? `Compró ${formatCurrency(compraMes)} en los últimos 30 días (más de ${formatCurrency(EXCEPCION_30D)})`
        : undefined;
  const requiereVideo = conProducto && !excepcion;
  const necesarias = [
    ...(requiereVideo ? ["Video de apertura"] : []),
    // Producto fallado: siempre foto o video, sin excepción (RN-53).
    ...(seed.tipo === 2 ? ["Foto de la falla"] : []),
  ];

  const resolucion = resolucionDe(seed);
  const estado = cambio?.estado ?? seed.estado;
  const origen = cambio?.origen ?? seed.origen;
  const ncNecesaria = resolucion.monto > 0;

  return {
    id: seed.id,
    pedidoId: pedido.id,
    clienta: clientaRef(pedido.clientaId),
    tipo: seed.tipo,
    sku: seed.sku,
    producto: producto.nombre,
    relato: seed.relato,
    estado,
    creadoAt: isoAgo(minutos, now),
    venceAt: isoAgo(minutos - SLA_HORAS * HOUR, now),
    horasRestantes: Math.round((SLA_HORAS * HOUR - minutos) / HOUR),
    evidencia: {
      requiereVideo,
      excepcion: conProducto ? excepcion : "No aplica: es un problema del envío",
      recibida: seed.recibida,
      falta: necesarias.filter((item) => !seed.recibida.includes(item)),
    },
    compraPedido,
    compra30d: compraMes,
    resolucion,
    notaCredito: {
      necesaria: ncNecesaria,
      cargada: ncNecesaria && estado === "resuelto",
      detalle: ncNecesaria
        ? [
            `Nota de crédito · pedido ${pedido.id} · ${clientaRef(pedido.clientaId).nombre}`,
            `Comprobante asociado: ${pedido.factura ?? "—"}`,
            `Ítem: ${presentacionesDe(producto).bulto.codigo} ${producto.nombre}`,
            `Motivo: tipo ${seed.tipo} · ${TIPOS_RECLAMO[seed.tipo].toLowerCase()}`,
            `Monto: ${formatCurrency(resolucion.monto)}`,
            "Reintegro: transferencia a la cuenta de la clienta",
          ].join("\n")
        : "",
    },
    origen,
    origenSugerido: seed.origenSugerido,
    responsable: "Lucía",
  };
}

function resumen(): PostventaResumen {
  const now = Date.now();
  const reclamos = RECLAMOS.map((seed) => toReclamo(seed, now));
  const abiertos = reclamos.filter((reclamo) => reclamo.estado !== "resuelto");
  const reintegrado = reclamos
    .filter((reclamo) => reclamo.estado === "resuelto" && Date.parse(reclamo.creadoAt) > now - 7 * DAY * 60_000)
    .reduce((sum, reclamo) => sum + reclamo.resolucion.monto, 0);

  const kpis: Kpi[] = [
    {
      id: "abiertos",
      label: "Reclamos abiertos",
      value: abiertos.length,
      format: "number",
      hint: "Responsable: Lucía",
    },
    {
      id: "vencen",
      label: "Vencen hoy",
      value: abiertos.filter((reclamo) => reclamo.horasRestantes <= 6).length,
      format: "number",
      hint: "Respuesta en 24 h como máximo (RN-50)",
    },
    {
      id: "reintegrado",
      label: "Reintegrado · 7 días",
      value: reintegrado,
      format: "currency",
      hint: "Con su nota de crédito vinculada",
    },
    {
      id: "tipo1",
      label: "Faltantes · 4 semanas",
      value: 7,
      format: "number",
      delta: { value: 3, unit: "number", period: "vs. las 4 anteriores", positive: false },
    },
  ];

  return {
    kpis,
    reclamos: reclamos.toSorted(
      (a, b) =>
        Number(a.estado === "resuelto") - Number(b.estado === "resuelto") || a.horasRestantes - b.horasRestantes,
    ),
    causas: {
      origenes: ORIGENES_RECLAMO,
      filas: [
        { tipo: 1, label: TIPOS_RECLAMO[1], porOrigen: { armado: 6, proveedor: 1 } },
        { tipo: 2, label: TIPOS_RECLAMO[2], porOrigen: { proveedor: 3, envio: 1 } },
        { tipo: 3, label: TIPOS_RECLAMO[3], porOrigen: { armado: 2, catalogo: 1 } },
        { tipo: 4, label: TIPOS_RECLAMO[4], porOrigen: { catalogo: 3, bot: 1 } },
        { tipo: 5, label: TIPOS_RECLAMO[5], porOrigen: { envio: 4 } },
        { tipo: 6, label: TIPOS_RECLAMO[6], porOrigen: { envio: 2, bot: 1 } },
      ],
    },
    tendenciaTipo1: [
      { semana: "Hace 3 semanas", cantidad: 1 },
      { semana: "Hace 2 semanas", cantidad: 1 },
      { semana: "Semana pasada", cantidad: 2 },
      { semana: "Esta semana", cantidad: 3 },
    ],
    escalar: {
      activo: true,
      mensaje:
        "Los faltantes subieron tres semanas seguidas y 6 de 7 vienen del armado. Conviene pasar el control de armado de registro a muestreo (RN-63).",
    },
  };
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/postventa$/, handler: () => Response.json(resumen()) },
  {
    method: "POST",
    pattern: /^\/postventa\/([^/]+)\/resolver$/,
    handler: async ({ params: [raw], request }) => {
      const id = decodeURIComponent(raw);
      const { origen } = await readJson<{ origen: OrigenReclamo }>(request);
      if (!RECLAMOS.some((reclamo) => reclamo.id === id)) return errorResponse(404, `No existe el reclamo ${id}.`);
      if (!origen || !ORIGENES_RECLAMO.some((item) => item.id === origen)) {
        return errorResponse(422, "El origen probable es obligatorio (RN-62).");
      }
      getPostventaDb().cambios.set(id, { estado: "resuelto", origen });
      return Response.json({ ok: true });
    },
  },
];
