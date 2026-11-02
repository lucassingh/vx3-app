import type {
  CajaEnvio,
  CotizacionEnvio,
  CotizadorOpciones,
  CotizarInput,
  DesviosEnvio,
  EnvioDelDia,
  GrupoDespacho,
  OpcionEnvio,
  Transporte,
  Zona,
} from "@/lib/api/types";
import { ZONA } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import {
  clientas,
  cotizarCorreo,
  DAY,
  detalleDe,
  getClienta,
  getPedido,
  getProducto,
  PEDIDO_MINIMO,
  presentacionesDe,
  productos,
  TARIFAS,
} from "../seed";
import { getPedidosDb } from "./pedidos";

/** M6 · Envíos: despacho del día, armado de bultos y cotizador con respaldo. */

/* ---- Códigos postales (RF-M6-02) ------------------------------------------ */

type Destino = { localidad: string; provincia: string; zona: Zona };

const CPS = new Map<string, Destino>([
  ...clientas.map((clienta): [string, Destino] => [
    clienta.cp,
    { localidad: clienta.localidad, provincia: clienta.provincia, zona: clienta.zona },
  ]),
  ["3016", { localidad: "Santo Tomé", provincia: "Santa Fe", zona: "interior" }],
  ["1900", { localidad: "La Plata", provincia: "Buenos Aires", zona: "interior" }],
  ["7000", { localidad: "Tandil", provincia: "Buenos Aires", zona: "interior" }],
]);

/** CP que la clienta pasó en el chat, cuando no coincide con su localidad (para mostrar la validación). */
const CP_DECLARADO: Record<string, string> = { "V-1051": "3016" };

/* ---- Armado de bultos (RF-M6-01) ------------------------------------------ */

const CAJAS = [
  { nombre: "Caja chica", medidas: [30, 20, 15], pesoKg: 0.2 },
  { nombre: "Caja mediana", medidas: [40, 30, 25], pesoKg: 0.35 },
  { nombre: "Caja grande", medidas: [60, 40, 30], pesoKg: 0.6 },
] as const;

/** Máximo por bulto del Correo: 25 kg y 150 cm por lado. */
const MAX_KG = 25;
const OCUPACION = 0.8;
const volumen = (medidas: readonly number[]) => medidas.reduce((product, side) => product * side, 1);

export function armarCajas(items: { sku: string; bultos: number }[]): CajaEnvio[] {
  const unidades = items
    .flatMap(({ sku, bultos }) => {
      const producto = getProducto(sku);
      const codigo = presentacionesDe(producto).bulto.codigo;
      return Array.from({ length: Math.max(0, bultos) }, () => ({
        codigo,
        vol: volumen(producto.medidasCm),
        kg: producto.pesoBultoKg,
      }));
    })
    .toSorted((a, b) => b.vol - a.vol);

  const capacidad = volumen(CAJAS[2].medidas) * OCUPACION;
  const cajas: (typeof unidades)[] = [];
  for (const unidad of unidades) {
    const caja = cajas.find(
      (items) =>
        items.reduce((sum, item) => sum + item.vol, unidad.vol) <= capacidad &&
        items.reduce((sum, item) => sum + item.kg, unidad.kg) + CAJAS[2].pesoKg <= MAX_KG,
    );
    if (caja) caja.push(unidad);
    else cajas.push([unidad]);
  }

  return cajas.map((items, index) => {
    const vol = items.reduce((sum, item) => sum + item.vol, 0);
    const tipo = CAJAS.find((caja) => volumen(caja.medidas) * OCUPACION >= vol) ?? CAJAS[2];
    const conteo = new Map<string, number>();
    for (const item of items) conteo.set(item.codigo, (conteo.get(item.codigo) ?? 0) + 1);
    return {
      id: `B${index + 1}`,
      caja: tipo.nombre,
      medidas: tipo.medidas.join(" × ") + " cm",
      pesoKg: Math.round((items.reduce((sum, item) => sum + item.kg, 0) + tipo.pesoKg) * 100) / 100,
      contenido: [...conteo].map(([codigo, cantidad]) => `${codigo} ×${cantidad}`).join(" · "),
    };
  });
}

/* ---- Despacho del día (RN-80) --------------------------------------------- */

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

function estadoCorte(hora: string | null): GrupoDespacho["corteEstado"] {
  if (!hora) return "sin_corte";
  const [h, m] = hora.split(":").map(Number);
  const faltan = h * 60 + m - minutosAhoraBA();
  return faltan <= 0 ? "cerrado" : faltan <= 90 ? "proximo" : "a_tiempo";
}

const GRUPOS: {
  transporte: Transporte;
  label: string;
  corte: string | null;
  corteDetalle: string;
  accion: { id: GrupoDespacho["accion"]["id"]; label: string };
}[] = [
  { transporte: "mensajeria", label: "Mensajería · Transtech", corte: "12:00", corteDetalle: "Etiquetas y carga en Zupply antes del mediodía", accion: { id: "zupply", label: "Subir a Zupply" } },
  { transporte: "via_cargo", label: "Vía Cargo", corte: "17:30", corteDetalle: "La clienta paga el flete al retirar en la sucursal", accion: { id: "etiquetas", label: "Imprimir etiquetas" } },
  { transporte: "correo", label: "Correo Argentino · MiCorreo", corte: "18:30", corteDetalle: "Se importa en MiCorreo con la tarifa Paq.ar, no la de encomienda clásica", accion: { id: "micorreo", label: "Importar en MiCorreo" } },
  { transporte: "retira", label: "Retira en el local", corte: null, corteDetalle: "Seña del 10 % cobrada; el saldo se cobra al retirar", accion: { id: "aviso", label: "Avisar que está listo" } },
];

const getEnviosDb = defineStore("envios", () => ({
  hechos: new Set<Transporte>(),
  etiquetas: new Map<string, string>([["V-1048", "VC-0458812"]]),
  nextZupply: 88_412,
  nextCorreo: 31_120_457,
  cotizaciones: new Map<string, CotizacionEnvio>(),
  guardadas: new Set<string>(),
  nextCotizacion: 4_821,
}));

const ESTADO_ENVIO: Partial<Record<string, EnvioDelDia["estado"]>> = {
  pendiente_pago: "esperando_pago",
  listo_facturar: "por_facturar",
  facturado: "en_armado",
  en_armado: "en_armado",
  despachado: "despachado",
};

function envioDe(pedidoId: string): EnvioDelDia {
  const db = getEnviosDb();
  const pedido = getPedidosDb().pedidos.find((item) => item.id === pedidoId)!;
  const clienta = getClienta(pedido.clientaId);
  const detalle = detalleDe(pedido);
  const cp = CP_DECLARADO[pedido.id] ?? clienta.cp;
  const destino = CPS.get(cp);
  const cpValido = destino?.localidad === clienta.localidad;
  let estado = ESTADO_ENVIO[pedido.estado] ?? "por_facturar";
  if (estado === "en_armado" && db.hechos.has(pedido.transporte)) estado = "subido";

  return {
    pedidoId: pedido.id,
    clienta: { id: clienta.id, nombre: clienta.nombre, telefono: clienta.telefono },
    localidad: clienta.localidad,
    provincia: clienta.provincia,
    cp,
    zona: clienta.zona,
    cpValido,
    cpDetalle: cpValido
      ? `CP ${cp} validado: ${clienta.localidad}`
      : `El CP ${cp} es de ${destino?.localidad ?? "otra localidad"}, no de ${clienta.localidad}. Confirmalo con la clienta antes de etiquetar.`,
    cajas: pedido.transporte === "retira" ? 0 : armarCajas(pedido.items).length,
    bultos: pedido.items.reduce((sum, item) => sum + item.bultos, 0),
    pesoKg: detalle.pesoKg,
    pago: pedido.pago,
    aCobrar: pedido.pago === "contraentrega" ? detalle.total : undefined,
    estado,
    etiqueta: db.etiquetas.get(pedido.id) ?? null,
    seguimiento: `vx3.com.ar/seguimiento/${pedido.id}`,
  };
}

function despacho(): GrupoDespacho[] {
  const db = getEnviosDb();
  const hoy = getPedidosDb().pedidos.filter(
    (pedido) => pedido.creadoHaceMin < DAY && pedido.estado in ESTADO_ENVIO,
  );
  return GRUPOS.map((grupo) => ({
    transporte: grupo.transporte,
    label: grupo.label,
    corte: grupo.corte,
    corteDetalle: grupo.corteDetalle,
    corteEstado: estadoCorte(grupo.corte),
    accion: { ...grupo.accion, hecho: db.hechos.has(grupo.transporte) },
    envios: hoy
      .filter((pedido) => pedido.transporte === grupo.transporte)
      .toSorted((a, b) => b.creadoHaceMin - a.creadoHaceMin)
      .map((pedido) => envioDe(pedido.id)),
  }));
}

function accionDespacho(transporte: Transporte) {
  const db = getEnviosDb();
  const grupo = despacho().find((item) => item.transporte === transporte);
  if (!grupo) return null;
  db.hechos.add(transporte);
  const listos = grupo.envios.filter((envio) => envio.estado === "en_armado");
  for (const envio of listos) {
    if (transporte === "mensajeria") db.etiquetas.set(envio.pedidoId, `ZP-${db.nextZupply++}`);
    if (transporte === "correo") db.etiquetas.set(envio.pedidoId, `CU${db.nextCorreo++}AR`);
  }
  const n = listos.length;
  const mensajes: Record<Transporte, string> = {
    mensajeria: `${n} ${n === 1 ? "envío subido" : "envíos subidos"} a Zupply con dirección, teléfono y monto a cobrar.`,
    correo: `${n} ${n === 1 ? "envío importado" : "envíos importados"} en MiCorreo con la tarifa Paq.ar.`,
    via_cargo: "Etiquetas enviadas a la impresora del depósito.",
    retira: "Le avisamos por WhatsApp que el pedido está listo para retirar.",
  };
  return mensajes[transporte];
}

/* ---- Control de desvíos (RF-M6-06) ---------------------------------------- */

const UMBRAL_DESVIO = 0.1;

function desvios(): DesviosEnvio {
  const casos = [
    { id: "V-1038", cobrado: 11_600, motivo: "El Correo volvió a pesar: declarado 0,7 kg, medido 1,9 kg con la caja." },
    { id: "V-1044", cobrado: 6_500, motivo: "Transtech la liquidó como zona 2: Morón es zona 1." },
    { id: "V-1037", cobrado: 10_200, motivo: "Diferencia chica por redondeo de peso." },
    { id: "V-1039", cobrado: null, motivo: "Cobró lo cotizado." },
    { id: "V-1045", cobrado: null, motivo: "Cobró lo cotizado." },
    { id: "V-1043", cobrado: null, motivo: "Cobró lo cotizado." },
  ].map(({ id, cobrado, motivo }) => {
    const pedido = getPedido(id);
    const cotizado = detalleDe(pedido).envio;
    const real = cobrado ?? cotizado;
    const desvio = (real - cotizado) / cotizado;
    return {
      pedidoId: id,
      clienta: getClienta(pedido.clientaId).nombre,
      transporte: pedido.transporte,
      cotizado,
      cobrado: real,
      desvio,
      alerta: desvio > UMBRAL_DESVIO,
      motivo,
    };
  });
  return { umbral: UMBRAL_DESVIO, casos: casos.toSorted((a, b) => b.desvio - a.desvio) };
}

/* ---- Cotizador (RF-M6-01, 03, 09) ----------------------------------------- */

const ceil100 = (value: number) => Math.ceil(value / 100) * 100;

/** Vigencia de una cotización guardada (RF-M6-03). */
const VIGENCIA_HORAS = 48;

/** Tabla propia por zona y peso, para cuando MiCorreo no responde. Suma un margen de seguridad. */
function respaldoCorreo(zona: Zona, kg: number) {
  const bandas = zona === "interior"
    ? [[1, 9_800], [3, 12_400], [5, 14_900], [10, 19_800], [25, 27_900]]
    : [[1, 8_400], [3, 10_600], [5, 12_700], [10, 16_900], [25, 23_800]];
  return bandas.find(([hasta]) => kg <= hasta)?.[1] ?? 27_900;
}

function opcionesCotizador(): CotizadorOpciones {
  return {
    productos: productos
      .filter((producto) => producto.estado !== "borrador")
      .map((producto) => {
        const { bulto } = presentacionesDe(producto);
        return {
          sku: producto.sku,
          label: `${bulto.codigo} · ${producto.nombre}`,
          detalle: `${bulto.label} · ${formatCurrency(bulto.precio)} · ${producto.pesoBultoKg.toLocaleString("es-AR")} kg`,
        };
      }),
    destinos: [
      { cp: "1824", localidad: "Lanús", zona: ZONA.amba_1.label },
      { cp: "1759", localidad: "González Catán", zona: ZONA.amba_2.label },
      { cp: "2000", localidad: "Rosario", zona: ZONA.interior.label },
      { cp: "8300", localidad: "Neuquén", zona: ZONA.interior.label },
    ],
  };
}

function cotizar(input: Partial<CotizarInput>): CotizacionEnvio {
  const db = getEnviosDb();
  const cp = String(input.cp ?? "").trim();
  const items = (input.items ?? []).filter(
    (item) => item.bultos > 0 && productos.some((producto) => producto.sku === item.sku),
  );
  const destino = CPS.get(cp);
  const localidad = input.localidad?.trim();
  const localidadOk = !localidad || !destino || destino.localidad.toLowerCase().includes(localidad.toLowerCase());

  const cajas = armarCajas(items);
  const pesoTotalKg = Math.round(cajas.reduce((sum, caja) => sum + caja.pesoKg, 0) * 100) / 100;
  const mercaderia = items.reduce((sum, item) => {
    const { bulto } = presentacionesDe(getProducto(item.sku));
    return sum + bulto.precio * item.bultos;
  }, 0);
  const respaldo = Boolean(input.simularFalla);
  const sucursal = input.modoCorreo === "sucursal";

  const opciones: OpcionEnvio[] = [];
  if (destino) {
    const amba = destino.zona !== "interior";
    const porCaja = cajas.map((caja) => {
      const base = respaldo ? respaldoCorreo(destino.zona, caja.pesoKg) : cotizarCorreo(caja.pesoKg);
      return sucursal ? ceil100(base * 0.85) : base;
    });
    opciones.push(
      {
        id: "mensajeria",
        label: "Mensajería · Transtech",
        precio: amba ? (destino.zona === "amba_1" ? TARIFAS.envio1 : TARIFAS.envio2) : null,
        embalaje: TARIFAS.embalaje1,
        disponible: amba,
        estimada: false,
        detalle: amba
          ? `${ZONA[destino.zona].label} · admite contraentrega · sale hoy si se cierra antes de las 11`
          : "La mensajería solo llega a AMBA",
        recomendada: amba,
      },
      {
        id: "correo",
        label: `Correo Argentino · ${sucursal ? "sucursal" : "domicilio"}`,
        precio: porCaja.reduce((sum, value) => sum + value, 0),
        embalaje: TARIFAS.embalaje2,
        disponible: cajas.length > 0,
        estimada: respaldo,
        detalle: respaldo
          ? "Estimada con la tabla de respaldo por zona y peso"
          : `Bulto por bulto en MiCorreo · ${cajas.length} ${cajas.length === 1 ? "caja" : "cajas"} · 3 a 6 días hábiles`,
        porCaja,
        recomendada: !amba,
      },
      {
        id: "via_cargo",
        label: "Vía Cargo",
        precio: null,
        embalaje: TARIFAS.embalaje2,
        disponible: !amba,
        estimada: false,
        detalle: amba ? "Para AMBA conviene la mensajería" : "La clienta paga el flete al retirar en la sucursal (RN-83)",
      },
      {
        id: "retira",
        label: "Retira en el local",
        precio: 0,
        embalaje: 0,
        disponible: true,
        estimada: false,
        detalle: `Seña del 10 %: ${formatCurrency(ceil100(mercaderia * 0.1))} (RN-28)`,
      },
    );
  }

  const id = `C-${db.nextCotizacion++}`;
  const cotizacion: CotizacionEnvio = {
    id,
    venceAt: new Date(Date.now() + VIGENCIA_HORAS * 60 * 60_000).toISOString(),
    vigenciaHoras: VIGENCIA_HORAS,
    destino: {
      cp,
      localidad: destino?.localidad ?? localidad ?? "",
      provincia: destino?.provincia ?? "",
      zona: destino?.zona ?? null,
      valido: Boolean(destino) && localidadOk,
      detalle: !destino
        ? `No encontramos el CP ${cp || "ingresado"} en la base de MiCorreo. Revisalo con la clienta.`
        : localidadOk
          ? `CP ${cp} · ${destino.localidad}, ${destino.provincia} · ${ZONA[destino.zona].label}`
          : `El CP ${cp} es de ${destino.localidad}, no de ${localidad}. Confirmalo antes de cotizar.`,
    },
    cajas,
    pesoTotalKg,
    mercaderia,
    faltaParaMinimo: Math.max(0, PEDIDO_MINIMO - mercaderia),
    fuente: respaldo ? "respaldo" : "micorreo",
    aviso: respaldo
      ? "MiCorreo no respondió en 8 segundos. La cotización sale de la tabla de respaldo: el bot le avisa a la clienta que el monto es estimado."
      : undefined,
    opciones,
  };
  db.cotizaciones.set(id, cotizacion);
  return cotizacion;
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/envios\/despacho$/, handler: () => Response.json(despacho()) },
  {
    method: "POST",
    pattern: /^\/envios\/despacho\/(mensajeria|correo|via_cargo|retira)$/,
    handler: ({ params: [transporte] }) => {
      const mensaje = accionDespacho(transporte as Transporte);
      return mensaje
        ? Response.json({ ok: true, mensaje })
        : errorResponse(404, `No hay despacho para ${transporte}.`);
    },
  },
  { method: "GET", pattern: /^\/envios\/desvios$/, handler: () => Response.json(desvios()) },
  { method: "GET", pattern: /^\/envios\/cotizador$/, handler: () => Response.json(opcionesCotizador()) },
  {
    method: "POST",
    pattern: /^\/envios\/cotizar$/,
    handler: async ({ request }) => Response.json(cotizar(await readJson<CotizarInput>(request))),
  },
  {
    method: "POST",
    pattern: /^\/envios\/cotizaciones\/([^/]+)$/,
    handler: ({ params: [raw] }) => {
      const id = decodeURIComponent(raw);
      const db = getEnviosDb();
      if (!db.cotizaciones.has(id)) return errorResponse(404, `No existe la cotización ${id}.`);
      db.guardadas.add(id);
      return Response.json({ ok: true, id });
    },
  },
];
