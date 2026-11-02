import type {
  Banco,
  CajaDelDia,
  CasoContraentrega,
  CompromisoCaja,
  ComprobanteLeido,
  ConciliacionResumen,
  ContraentregaResumen,
  CuentaCaja,
  ExtractoBanco,
  IngresoEsperado,
  Kpi,
  LiquidacionTranstech,
  PropuestaCruce,
  ReclamoTranstech,
  SinCruce,
  TipoCasoContraentrega,
} from "@/lib/api/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import {
  clientaRef,
  contraentregaPendiente,
  dateAgo,
  DAY,
  detalleDe,
  getClienta,
  getPedido,
  HOUR,
  isoAgo,
  pedidos,
  proveedores,
} from "../seed";

/** M7 · Cobros y conciliación. */

/* ---- Conciliación (RF-M7-01 a RF-M7-05) ----------------------------------- */

const propuesta = (
  id: string,
  pedidoId: string,
  banco: Banco,
  titular: string,
  minutos: number,
  puntaje: number,
  razones: [string, boolean][],
) => ({ id, pedidoId, banco, titular, minutos, puntaje, razones });

const PROPUESTAS = [
  propuesta("m-301", "V-1056", "santander", "RIOS AGUSTINA BELEN", 70, 97, [
    ["Monto exacto", true],
    ["Titular coincide con la clienta", true],
    ["Comprobante del chat leído por IA", true],
    ["Dentro de la ventana de ±2 días", true],
  ]),
  propuesta("m-302", "V-1054", "provincia", "IBAÑEZ PAOLA VANESA", 125, 86, [
    ["Monto exacto", true],
    ["Titular coincide con la clienta", true],
    ["Todavía no mandó el comprobante por el chat", false],
    ["Dentro de la ventana de ±2 días", true],
  ]),
  propuesta("m-303", "V-1059", "santander", "BENITEZ JORGE OMAR", 15, 74, [
    ["Monto exacto", true],
    ["A nombre de otra persona (sirve: RN-42)", false],
    ["El comprobante del chat dice Jorge Benítez", true],
    ["Dentro de la ventana de ±2 días", true],
  ]),
  propuesta("m-298", "V-1045", "supervielle", "QUIROGA JOHANA", 27 * HOUR, 99, [
    ["Monto exacto", true],
    ["Titular coincide con la clienta", true],
    ["Comprobante del chat leído por IA", true],
    ["Dentro de la ventana de ±2 días", true],
  ]),
  propuesta("m-291", "V-1043", "santander", "GAITAN ROMINA SOLEDAD", 2 * DAY + 4 * HOUR, 95, [
    ["Monto exacto", true],
    ["Titular coincide con la clienta", true],
    ["Comprobante del chat leído por IA", true],
    ["Fuera de la ventana: entró hace más de 2 días", false],
  ]),
];

const SIN_CRUCE: (Omit<SinCruce, "fecha"> & { minutos: number })[] = [
  {
    id: "s-1",
    tipo: "movimiento_sin_pedido",
    caso: "pago_sin_pedido",
    monto: 86_400,
    banco: "supervielle",
    titular: "DISTRIBUIDORA LM SRL",
    minutos: 26 * HOUR,
    detalle:
      "Coincide el monto con V-1055 de Romina Gaitán, pero entró un día antes de que existiera el pedido. Un monto igual no alcanza para cruzar (RN-91).",
    sugerencia: "Buscalo entre las ventas del local o preguntale a la clienta por el chat.",
  },
  {
    id: "s-2",
    tipo: "movimiento_sin_pedido",
    caso: "tercero",
    monto: 52_000,
    banco: "provincia",
    titular: "MARTINEZ LUCAS EZEQUIEL",
    minutos: 5 * HOUR,
    detalle: "A nombre de un tercero y sin comprobante en ninguna conversación.",
    sugerencia: "Si una clienta manda el comprobante, se cruza solo. Un comprobante a nombre de otra persona sirve (RN-42).",
  },
  {
    id: "s-3",
    tipo: "comprobante_sin_movimiento",
    caso: "otro_alias",
    monto: 38_400,
    banco: null,
    titular: "Daiana Ferreyra",
    minutos: 45,
    detalle: "Mandó un comprobante por $ 38.400 para V-1057, pero el alias de destino (dai.ventas.mp) no es de VX3.",
    sugerencia: "Pedile que confirme a qué alias transfirió. Si no aparece, el pedido sigue como contraentrega.",
  },
];

const getConciliacionDb = defineStore("cobros", () => ({
  estados: new Map<string, PropuestaCruce["estado"]>(),
  nextCobro: 4_412,
  reclamoEnviado: false,
}));

function propuestas(now: number): PropuestaCruce[] {
  const db = getConciliacionDb();
  return PROPUESTAS.map((item) => {
    const pedido = getPedido(item.pedidoId);
    const total = detalleDe(pedido).total;
    return {
      id: item.id,
      movimiento: {
        id: item.id,
        banco: item.banco,
        fecha: isoAgo(item.minutos, now),
        monto: total,
        titular: item.titular,
        horasSinCargar: Math.floor(item.minutos / HOUR),
      },
      pedido: { id: pedido.id, clienta: clientaRef(pedido.clientaId), total },
      puntaje: item.puntaje,
      razones: item.razones.map(([label, ok]) => ({ label, ok })),
      estado: db.estados.get(item.id) ?? "propuesta",
    };
  });
}

function conciliacion(): ConciliacionResumen {
  const now = Date.now();
  const lista = propuestas(now);
  const pendientes = lista.filter((item) => item.estado === "propuesta");
  const horas = [
    ...pendientes.map((item) => item.movimiento.horasSinCargar),
    ...SIN_CRUCE.filter((item) => item.banco).map((item) => Math.floor(item.minutos / HOUR)),
  ];
  const confirmadasHoy = lista.filter((item) => item.estado === "confirmada").length;

  const kpis: Kpi[] = [
    {
      id: "sin-conciliar",
      label: "Sin conciliar",
      value: pendientes.length + SIN_CRUCE.length,
      format: "number",
      hint: `${pendientes.length} con cruce propuesto · ${SIN_CRUCE.length} sin cruce`,
    },
    {
      id: "automaticas",
      label: "Conciliadas solas · hoy",
      value: (9 + confirmadasHoy) / (11 + confirmadasHoy),
      format: "percent",
      hint: `${9 + confirmadasHoy} de ${11 + confirmadasHoy} transferencias del día`,
    },
    {
      id: "24h",
      label: "Pendientes de más de 24 h",
      value: horas.filter((hora) => hora >= 24 && hora < 48).length,
      format: "number",
      hint: "Todo pago se carga dentro de las 24 h (RN-40)",
    },
    {
      id: "viejos",
      label: "Viejos (más de 2 días)",
      value: horas.filter((hora) => hora >= 48).length,
      format: "number",
      hint: "Van al corte semanal (RN-44)",
    },
  ];

  const extractos: ExtractoBanco[] = [
    { banco: "santander", importadoAt: isoAgo(40, now), formato: "Extracto CSV", movimientos: 23, conciliados: 20 },
    { banco: "supervielle", importadoAt: isoAgo(40, now), formato: "Extracto Excel", movimientos: 14, conciliados: 12 },
    { banco: "provincia", importadoAt: isoAgo(2 * HOUR, now), formato: "Extracto CSV", movimientos: 9, conciliados: 7 },
    { banco: "nacion", importadoAt: isoAgo(3 * HOUR, now), formato: "Extracto PDF", movimientos: 6, conciliados: 6 },
  ];

  const estadoDe = (id: string): ComprobanteLeido["estado"] =>
    getConciliacionDb().estados.get(id) === "confirmada" ? "conciliado" : "propuesto";
  const comprobantes: ComprobanteLeido[] = [
    { id: "cp-1", clienta: "Celeste Benítez", recibidoAt: isoAgo(14, now), monto: 42_000, banco: "Santander", titular: "Benítez Jorge Omar", operacion: "4471-3390-1027", pedidoId: "V-1059", confianza: 0.95, estado: estadoDe("m-303") },
    { id: "cp-2", clienta: "Daiana Ferreyra", recibidoAt: isoAgo(45, now), monto: 38_400, banco: "Mercado Pago", titular: "Ferreyra Daiana", operacion: "MP-77120938", pedidoId: "V-1057", confianza: 0.91, estado: "sin_cruce" },
    { id: "cp-3", clienta: "Agustina Ríos", recibidoAt: isoAgo(68, now), monto: detalleDe(getPedido("V-1056")).total, banco: "Santander", titular: "Ríos Agustina Belén", operacion: "4471-2209-8813", pedidoId: "V-1056", confianza: 0.98, estado: estadoDe("m-301") },
    { id: "cp-4", clienta: "Romina Gaitán", recibidoAt: isoAgo(92, now), monto: detalleDe(getPedido("V-1055")).total, banco: "Supervielle", titular: "Gaitán Romina Soledad", operacion: "SV-20581144", pedidoId: "V-1055", confianza: 0.99, estado: "conciliado" },
    { id: "cp-5", clienta: "Carolina Vera", recibidoAt: isoAgo(262, now), monto: detalleDe(getPedido("V-1049")).total, banco: "Provincia", titular: "Vera Carolina", operacion: "BP-0091283", pedidoId: "V-1049", confianza: 0.97, estado: "conciliado" },
  ];

  return {
    kpis,
    extractos,
    propuestas: lista,
    sinCruce: SIN_CRUCE.map(({ minutos, ...item }) => ({ ...item, fecha: isoAgo(minutos, now) })),
    comprobantes,
  };
}

function confirmar(id: string) {
  const db = getConciliacionDb();
  if (!PROPUESTAS.some((item) => item.id === id)) return null;
  db.estados.set(id, "confirmada");
  return `Cobro 0002-0000${db.nextCobro++}`;
}

/* ---- Contraentrega con Transtech (RF-M7-06 a RF-M7-09) -------------------- */

type CasoSeed = [
  pedidoId: string,
  clientaId: string,
  monto: number | null,
  grupo: CasoContraentrega["grupo"],
  tipo: TipoCasoContraentrega | null,
  zupply: string,
  real: string,
  dias: number,
];

/** Los 17 casos del último corte. `monto: null` toma el total real del pedido de la semilla. */
const CASOS: CasoSeed[] = [
  ["V-1042", "c-11", null, "entregado_sin_rendir", "entregado_sin_rendir", "Entregado", "Entregado, sin rendición", 2],
  ["V-1041", "c-11", null, "entregado_sin_rendir", "efectivo_chofer", "Entregado", "Cobrado en efectivo por el chofer", 4],
  ["V-1033", "c-04", null, "entregado_sin_rendir", "otro_alias", "En camino", "Pagó por transferencia a un alias que no es de VX3", 9],
  ["V-1026", "c-15", 61_400, "entregado_sin_rendir", "entregado_sin_rendir", "Entregado", "Entregado, sin rendición", 6],
  ["V-1024", "c-04", 58_900, "entregado_sin_rendir", "pago_sin_pedido", "Entregado", "Transferencia que no cubre un pedido claro: dice que pagó dos juntos", 7],
  ["V-1021", "c-19", 63_200, "entregado_sin_rendir", "envio_duplicado", "Entregado (2 envíos)", "Un solo pedido: Zupply tiene ZP-87120 y ZP-87188", 8],
  ["V-1019", "c-13", 56_800, "entregado_sin_rendir", "entregado_sin_rendir", "En camino", "Entregado: la clienta lo confirmó por WhatsApp", 9],
  ["V-1017", "c-04", 65_400, "entregado_sin_rendir", "efectivo_chofer", "Entregado", "Cobrado en efectivo por el chofer", 10],
  ["V-1044", "c-15", null, "en_camino", null, "En camino", "En camino desde ayer", 1],
  ["V-1030", "c-01", 59_800, "en_camino", "rebote_fecha", "En camino", "Rebotó el sábado: estaba programado para el domingo", 4],
  ["V-1029", "c-15", 54_300, "en_camino", "devolucion_fisica", "En camino", "Volvió al local el lunes, sin registrar en Zupply", 5],
  ["V-1028", "c-04", 62_700, "en_camino", null, "En camino", "En camino", 2],
  ["V-1027", "c-11", 55_100, "en_camino", "envio_duplicado", "En camino (2 envíos)", "El mismo pedido salió en dos envíos", 5],
  ["V-1025", "c-19", 58_600, "en_camino", "entregado_sin_rendir", "En camino", "Entregado el viernes: lo confirmó la clienta", 6],
  ["V-1020", "c-01", 52_600, "ausente", "rebote_fecha", "Ausente", "Ausente: hay que reprogramar", 4],
  ["V-1018", "c-13", 56_900, "ausente", "devolucion_fisica", "Ausente", "Devuelto al local", 7],
  ["V-1016", "c-02", 54_500, "ausente", "efectivo_chofer", "Ausente", "Pagó en efectivo: mandó la foto del recibo", 8],
];

/** Pedidos donde el estado de Zupply no es el real (RF-M7-08). */
const ZUPPLY_EQUIVOCADO = new Set(["V-1033", "V-1021", "V-1019", "V-1030", "V-1029", "V-1027", "V-1025", "V-1018", "V-1016"]);

export const TIPO_CASO: Record<TipoCasoContraentrega, string> = {
  entregado_sin_rendir: "Entregado sin rendir",
  efectivo_chofer: "Efectivo al chofer",
  otro_alias: "Cobro a otro alias",
  pago_sin_pedido: "Pago sin pedido claro",
  envio_duplicado: "Envío duplicado",
  rebote_fecha: "Rebote por fecha mal programada",
  devolucion_fisica: "Devolución física",
};

function casos(): CasoContraentrega[] {
  return CASOS.map(([pedidoId, clientaId, monto, grupo, tipo, zupply, real, dias]) => {
    const clienta = getClienta(clientaId);
    return {
      id: `ce-${pedidoId}`,
      pedidoId,
      clienta: clientaRef(clientaId),
      localidad: clienta.localidad,
      monto: monto ?? detalleDe(getPedido(pedidoId)).total,
      grupo,
      tipo,
      estadoZupply: zupply,
      estadoReal: real,
      coincide: !ZUPPLY_EQUIVOCADO.has(pedidoId),
      dias,
    };
  });
}

/** Lunes de la semana de `now` (UTC), a medianoche. */
function lunesDe(now: number) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function liquidaciones(now: number): LiquidacionTranstech[] {
  const lunes = lunesDe(now);
  const semana = (n: number) => ({
    desde: isoDate(lunes - n * 7 * DAY * 60_000),
    hasta: isoDate(lunes - n * 7 * DAY * 60_000 + 5 * DAY * 60_000),
  });
  return [
    { id: "liq-3", ...semana(1), rendido: 2_184_000, reclamado: 214_000, recuperado: 162_000, estado: "en_reclamo", nota: "Federico reconoció 4 de 6 casos; quedan 2 rebotes por revisar." },
    { id: "liq-2", ...semana(2), rendido: 2_410_000, reclamado: 187_000, recuperado: 187_000, estado: "cerrada", nota: "Todo recuperado en la rendición siguiente." },
    { id: "liq-1", ...semana(3), rendido: 1_960_000, reclamado: 143_000, recuperado: 98_000, estado: "cerrada", nota: "$ 45.000 de un envío duplicado se descontaron del reparto." },
  ];
}

function contraentrega(): ContraentregaResumen {
  return {
    totales: {
      total: contraentregaPendiente.total,
      entregadosSinRendir: { ...contraentregaPendiente.entregadosSinRendir },
      enCamino: { ...contraentregaPendiente.enCamino },
      ausentes: { ...contraentregaPendiente.ausentes },
    },
    ciclo: [
      { id: "facturado", label: "Facturados", cantidad: 41 },
      { id: "despachado", label: "Despachados", cantidad: 38 },
      { id: "entregado", label: "Entregados", cantidad: 29 },
      { id: "cobrado", label: "Cobrados por Transtech", cantidad: 22 },
      { id: "rendido", label: "Rendidos", cantidad: 18 },
      { id: "devuelto", label: "Devueltos", cantidad: 3 },
    ],
    casos: casos(),
    liquidaciones: liquidaciones(Date.now()),
  };
}

function reclamo(): ReclamoTranstech {
  const now = Date.now();
  const lunes = lunesDe(now);
  const desde = isoDate(lunes);
  const hasta = isoDate(lunes + 5 * DAY * 60_000);
  const tipificados = casos().filter((caso) => caso.tipo !== null);

  const porTipo = (Object.keys(TIPO_CASO) as TipoCasoContraentrega[])
    .map((tipo) => {
      const delTipo = tipificados.filter((caso) => caso.tipo === tipo);
      return {
        tipo,
        label: TIPO_CASO[tipo],
        casos: delTipo.length,
        monto: delTipo.reduce((sum, caso) => sum + caso.monto, 0),
      };
    })
    .filter((item) => item.casos > 0);

  const total = tipificados.reduce((sum, caso) => sum + caso.monto, 0);
  const fecha = (iso: string) => formatDate(iso, { day: "2-digit", month: "2-digit" });
  const mensaje = [
    "Hola Federico, ¿cómo va?",
    `Te paso el reclamo de la semana del ${fecha(desde)} al ${fecha(hasta)}: ${tipificados.length} casos por ${formatCurrency(total)}.`,
    "",
    ...porTipo.map((item) => `• ${item.label}: ${item.casos} ${item.casos === 1 ? "caso" : "casos"}, ${formatCurrency(item.monto)}`),
    "",
    "En el Excel va cada pedido con la clienta, el monto, lo que figura en Zupply y lo que encontramos nosotros. ¿Lo cerramos con la rendición del lunes? Gracias.",
  ].join("\n");

  return { desde, hasta, porTipo, casos: tipificados.length, total, mensaje, enviado: getConciliacionDb().reclamoEnviado };
}

/** Cobros pendientes de más de 2 días, con su monto (Manual v4 P-07 R-5). Los usa el Inicio (P-15). */
export function cobrosViejos(now = Date.now()) {
  const montos = [
    ...propuestas(now)
      .filter((item) => item.estado === "propuesta" && item.movimiento.horasSinCargar >= 48)
      .map((item) => item.movimiento.monto),
    ...SIN_CRUCE.filter((item) => item.banco && item.minutos >= 2 * DAY).map((item) => item.monto),
  ];
  return { cantidad: montos.length, monto: montos.reduce((sum, monto) => sum + monto, 0) };
}

/* ---- Caja del día (RF-M7-10) ---------------------------------------------- */

const cuenta = (
  id: string,
  nombre: string,
  tipo: CuentaCaja["tipo"],
  saldo: number,
  haceMin: number,
  origen: CuentaCaja["origen"],
  now: number,
): CuentaCaja => ({ id, nombre, tipo, saldo, actualizadoAt: isoAgo(haceMin, now), origen });

/** Los saldos de los bancos salen del último extracto; el efectivo lo carga una persona. */
const getCajaDb = defineStore("cobros-caja", (now) => ({
  cuentas: [
    cuenta("santander", "Santander", "banco", 1_260_000, 5 * HOUR, "extracto", now),
    cuenta("supervielle", "Supervielle", "banco", 845_000, 5 * HOUR + 10, "extracto", now),
    cuenta("provincia", "Provincia", "banco", 312_000, 2 * DAY + 3 * HOUR, "extracto", now),
    cuenta("nacion", "Nación", "banco", 418_000, 3 * HOUR, "extracto", now),
    cuenta("efectivo", "Efectivo del local", "efectivo", 386_000, 2 * HOUR, "manual", now),
  ],
}));

/** Registro de gastos fijos (P-11): concepto, monto, en cuántos días vence y tipo. */
const COMPROMISOS: [string, string, number, number, CompromisoCaja["tipo"]][] = [
  ["g-alquiler-1", "Alquiler del local · primera cuota", 520_000, 0, "escalonado"],
  ["g-luz", "Luz del local", 74_000, 0, "fijo"],
  ["g-sueldos", "Sueldos del equipo", 980_000, 1, "fijo"],
  ["g-dux", "Abono de DUX", 96_000, 3, "debito"],
  ["g-prestamo", "Cuota del préstamo", 610_000, 4, "debito"],
  ["g-alquiler-2", "Alquiler del local · segunda cuota", 520_000, 5, "escalonado"],
  ["g-internet", "Internet y alarma", 58_000, 6, "debito"],
  ["g-tiendanube", "Tienda Nube", 49_000, 8, "debito"],
  ["g-monotributo", "Monotributo", 132_000, 9, "fijo"],
];

/** Hoy el saldo con cada proveedor queda como foto del comprobante en su chat (P-01). */
const SALDOS_PROVEEDOR: Record<string, number> = {
  "p-bethy": 380_000,
  "p-cintia": 260_000,
  "p-silvia": 210_000,
  "p-victoria": 145_000,
};

function ingresosEsperados(): IngresoEsperado[] {
  const sinConfirmar = pedidos.filter((pedido) => pedido.estado === "pendiente_pago");
  const { entregadosSinRendir } = contraentregaPendiente;
  return [
    {
      id: "transtech",
      concepto: "Rendición de Transtech",
      detalle: `${entregadosSinRendir.casos} entregados sin rendir · paga martes o miércoles`,
      monto: entregadosSinRendir.monto,
      probabilidad: 0.82,
    },
    {
      id: "transferencias",
      concepto: "Transferencias por confirmar",
      detalle: `${sinConfirmar.length} pedidos con el pago pendiente`,
      monto: sinConfirmar.reduce((sum, pedido) => sum + detalleDe(pedido).total, 0),
      probabilidad: 0.7,
    },
    {
      id: "local",
      concepto: "Venta del local",
      detalle: "Promedio de un día hábil, en efectivo y transferencia",
      monto: 210_000,
      probabilidad: 0.9,
    },
  ];
}

const sumar = (items: { monto: number }[]) => items.reduce((sum, item) => sum + item.monto, 0);

function caja(): CajaDelDia {
  const now = Date.now();
  const hoy = dateAgo(0, now);
  const compromisos: CompromisoCaja[] = COMPROMISOS.map(([id, concepto, monto, dias, tipo]) => ({
    id,
    concepto,
    monto,
    vence: dateAgo(-dias, now),
    tipo,
  }));
  const compromisosHoy = compromisos.filter((item) => item.vence === hoy);
  const proximos = compromisos.filter((item) => item.vence > hoy);
  const ingresos = ingresosEsperados();
  const esperado = Math.round(ingresos.reduce((sum, item) => sum + item.monto * item.probabilidad, 0));
  const { cuentas } = getCajaDb();
  const disponible = cuentas.reduce((sum, item) => sum + item.saldo, 0);
  const reserva = Math.max(0, sumar(proximos) - esperado);

  return {
    fecha: hoy,
    cuentas,
    disponible,
    compromisosHoy,
    proximos,
    ingresos,
    ingresosEsperados: esperado,
    reserva,
    capacidadCompra: disponible - sumar(compromisosHoy) - reserva,
    proveedores: proveedores
      .filter((proveedor) => SALDOS_PROVEEDOR[proveedor.id])
      .map((proveedor) => ({
        id: proveedor.id,
        proveedor: proveedor.nombre,
        saldo: SALDOS_PROVEEDOR[proveedor.id],
        condiciones: proveedor.condiciones,
        ultimaCompraDias: proveedor.ultimaCompraDias,
      }))
      .toSorted((a, b) => b.saldo - a.saldo),
  };
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/cobros\/caja$/, handler: () => Response.json(caja()) },
  {
    method: "POST",
    pattern: /^\/cobros\/caja\/cuentas\/([^/]+)$/,
    handler: async ({ params: [raw], request }) => {
      const id = decodeURIComponent(raw);
      const item = getCajaDb().cuentas.find((cuenta) => cuenta.id === id);
      if (!item) return errorResponse(404, `No existe la cuenta ${id}.`);
      const { saldo } = await readJson<{ saldo: number }>(request);
      if (typeof saldo !== "number" || !Number.isFinite(saldo) || saldo < 0) {
        return errorResponse(422, "El saldo tiene que ser un número mayor o igual a 0.");
      }
      Object.assign(item, { saldo: Math.round(saldo), origen: "manual", actualizadoAt: new Date().toISOString() });
      return Response.json(item);
    },
  },
  { method: "GET", pattern: /^\/cobros\/conciliacion$/, handler: () => Response.json(conciliacion()) },
  {
    method: "POST",
    pattern: /^\/cobros\/conciliacion\/([^/]+)\/confirmar$/,
    handler: ({ params: [id] }) => {
      const cobro = confirmar(decodeURIComponent(id));
      return cobro ? Response.json({ ok: true, cobro }) : errorResponse(404, `No existe la propuesta ${id}.`);
    },
  },
  {
    method: "POST",
    pattern: /^\/cobros\/conciliacion\/([^/]+)\/rechazar$/,
    handler: ({ params: [raw] }) => {
      const id = decodeURIComponent(raw);
      if (!PROPUESTAS.some((item) => item.id === id)) return errorResponse(404, `No existe la propuesta ${id}.`);
      getConciliacionDb().estados.set(id, "rechazada");
      return Response.json({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/cobros\/conciliacion\/confirmar-altos$/,
    handler: () => {
      const altos = propuestas(Date.now()).filter((item) => item.estado === "propuesta" && item.puntaje >= 90);
      for (const item of altos) confirmar(item.id);
      return Response.json({ confirmadas: altos.length });
    },
  },
  { method: "GET", pattern: /^\/cobros\/contraentrega$/, handler: () => Response.json(contraentrega()) },
  { method: "GET", pattern: /^\/cobros\/contraentrega\/reclamo$/, handler: () => Response.json(reclamo()) },
  {
    method: "POST",
    pattern: /^\/cobros\/contraentrega\/reclamo$/,
    handler: () => {
      getConciliacionDb().reclamoEnviado = true;
      return Response.json({ ok: true });
    },
  },
];
