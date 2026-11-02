import type { BotConfig, BotPrueba, BotPublicacion, BotRendimiento, RespuestaBot } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import {
  bultosDisponibles,
  clientaRef,
  DAY,
  detalleDe,
  getPedido,
  getProducto,
  HOUR,
  isoAgo,
  PEDIDO_MINIMO,
  presentacionesDe,
  TIPO_CAMBIO_USD,
} from "../seed";

/** M3 · Bot de ventas: rendimiento de la puesta en marcha y configuración de los socios. */

const pesos = (value: number) => formatCurrency(value);
const precio = (sku: string) => pesos(presentacionesDe(getProducto(sku)).bulto.precio);
const det = (id: string) => detalleDe(getPedido(id));

/** Costo promedio por conversación con Claude Haiku 5.5 (referencia de 05 §4.5). */
const COSTO_CONVERSACION_USD = 0.004;

function rendimiento(): BotRendimiento {
  return {
    kpis: [
      {
        id: "atendidas",
        label: "Conversaciones atendidas · 7 días",
        value: 1_284,
        format: "number",
        delta: { value: 0.09, unit: "percent", period: "vs. la semana anterior", positive: true },
      },
      {
        id: "sin-derivar",
        label: "Resueltas sin derivar",
        value: 0.79,
        format: "percent",
        hint: "El 21 % pasó a una persona, con su motivo",
      },
      {
        id: "primera-respuesta",
        label: "Primera respuesta, en segundos",
        value: 14,
        format: "number",
        hint: "Promedio de todo el día, también fuera de horario",
      },
      {
        id: "costo",
        label: "Costo por conversación",
        value: Math.round(COSTO_CONVERSACION_USD * TIPO_CAMBIO_USD),
        format: "currency",
        hint: "US$ 0,004 con Claude Haiku 5.5",
      },
    ],
    puestaEnMarcha: {
      etapa: "parcial",
      acierto: 0.89,
      umbral: 0.92,
      conversacionesEvaluadas: 412,
      correccionesEnSombra: 61,
      diasEnSombra: 14,
      horario: "Lunes a sábado de 9 a 20",
    },
    derivaciones: [
      { id: "reclamo", label: "Reclamo o enojo", value: 38 },
      { id: "persona", label: "Pidió hablar con una persona", value: 22 },
      { id: "inseguro", label: "El bot no estaba seguro", value: 17 },
      { id: "descuento", label: "Precio o descuento especial", value: 14 },
      { id: "comprobante", label: "Comprobante que no coincide", value: 11 },
      { id: "grande", label: "Pedido grande", value: 9 },
    ],
    recorridos: [
      {
        id: "A",
        nombre: "Viene de un anuncio o reel",
        descripcion: "Responde con el producto del anuncio, no con el catálogo",
        conversaciones: 612,
        acierto: 0.94,
        habilitado: true,
      },
      {
        id: "B",
        nombre: "Pregunta abierta",
        descripcion: "Busca por talle, color y tela y ofrece 3 a 5 opciones con foto",
        conversaciones: 284,
        acierto: 0.87,
        habilitado: true,
      },
      {
        id: "C",
        nombre: "Manda una captura",
        descripcion: "Búsqueda por imagen, para una fase posterior",
        conversaciones: 0,
        acierto: null,
        habilitado: false,
      },
      {
        id: "D",
        nombre: "Cierre del pedido",
        descripcion: "Mínimo, código postal, envío, pago y comprobante",
        conversaciones: 197,
        acierto: 0.9,
        habilitado: true,
      },
      {
        id: "E",
        nombre: "Pedido trabado",
        descripcion: "Tres seguimientos con una palanca cada uno y anulación a las 24 h",
        conversaciones: 143,
        acierto: 0.86,
        habilitado: true,
      },
      {
        id: "F",
        nombre: "Reclamo",
        descripcion: "Deja de vender, pide la evidencia y deriva a post-venta",
        conversaciones: 41,
        acierto: 0.97,
        habilitado: true,
      },
      {
        id: "G",
        nombre: "Estado del pedido",
        descripcion: "Responde con el estado real o deriva si hay demora",
        conversaciones: 135,
        acierto: 0.95,
        habilitado: true,
      },
    ],
    backlog: [
      {
        id: "B-1",
        criterio: "Entender la duda antes de mandar el catálogo",
        estado: "cumple",
        evidencia: "El 94 % de las conversaciones de anuncios arranca con el producto del anuncio",
      },
      {
        id: "B-2",
        criterio: "Link directo al producto, no al catálogo general",
        estado: "cumple",
        evidencia: "Cada producto va con su link de la vidriera",
      },
      {
        id: "B-3",
        criterio: "Nunca afirmar stock sin verificarlo",
        estado: "cumple",
        evidencia: "Consulta el stock en vivo antes de cerrar",
      },
      {
        id: "B-4",
        criterio: "Pedir solo la diferencia del mínimo",
        estado: "cumple",
        evidencia: "Dice cuánto falta exacto y lo suma al mismo pedido",
      },
      {
        id: "B-5",
        criterio: "Cotización de respaldo si el Correo no responde",
        estado: "en_prueba",
        evidencia: "Tabla por zona, peso y volumen, avisando que es estimada",
      },
      {
        id: "B-6",
        criterio: "Comprobante asociado al pedido",
        estado: "cumple",
        evidencia: "Lee el comprobante con IA y lo cruza con el total",
      },
      {
        id: "B-7",
        criterio: "Mensaje de cierre con horarios, contraentrega y seguimiento",
        estado: "cumple",
        evidencia: "Sale al confirmar y al despachar",
      },
      {
        id: "B-8",
        criterio: "Tres seguimientos y cancelación a las 24 h",
        estado: "en_prueba",
        evidencia: "Secuencia activa; falta medir una semana completa",
      },
      {
        id: "B-9",
        criterio: "Tomar pedidos de 2 o 3 productos en el chat",
        estado: "cumple",
        evidencia: "Arma el pedido sin pasar por el catálogo",
      },
    ],
  };
}

function respuestasSeed(now: number): RespuestaBot[] {
  const r = (
    id: string,
    clientaId: string,
    conversacionId: string,
    recorrido: RespuestaBot["recorrido"],
    hace: number,
    mensajeClienta: string,
    respuesta: string,
    herramientas: RespuestaBot["herramientas"],
    extra: Partial<RespuestaBot> = {},
  ): RespuestaBot => ({
    id,
    clienta: clientaRef(clientaId),
    conversacionId,
    recorrido,
    mensajeClienta,
    respuesta,
    herramientas,
    derivo: false,
    respondidaEn: isoAgo(hace, now),
    calificacion: null,
    costoUsd: 0.004,
    ...extra,
  });

  const can9 = getProducto("CAN9");
  return [
    r(
      "r-1",
      "c-19",
      "cv-10",
      "G",
      14,
      "Hola! Cuándo me llega el pedido?",
      "¡Hola Antonella! Tu pedido V-1050 ya está facturado y lo están armando. Sale hoy por la mensajería a San Martín y te llega entre hoy y mañana.",
      [{ nombre: "estado_pedido", detalle: "V-1050 · en armado · mensajería zona 1" }],
    ),
    r(
      "r-2",
      "c-05",
      "cv-01",
      "A",
      34,
      "Hola! quiero info de los corpiños del anuncio 😍",
      `¡Hola Celeste! Sí, es el corpiño armado Smart Sexy con aro y push up, curva 85 a 100. La media docena está ${precio("CAN9")} y hoy hay stock 🙌`,
      [
        { nombre: "ver_producto", detalle: "CAN9, desde el anuncio de origen (referral)" },
        { nombre: "ver_stock", detalle: `CAN9-6 · ${bultosDisponibles(can9)} bultos disponibles` },
      ],
      { calificacion: "buena" },
    ),
    r(
      "r-3",
      "c-21",
      "cv-06",
      "D",
      21,
      "[Comprobante de transferencia]",
      "¡Gracias Paola! Ya lo recibí. Una persona del equipo lo revisa y te confirma en un ratito.",
      [
        { nombre: "estado_pedido", detalle: `V-1054 · total ${pesos(det("V-1054").total)}` },
        { nombre: "derivar", detalle: "El comprobante tiene $ 500 menos que el total" },
      ],
      { derivo: true, motivoDerivacion: "Comprobante que no coincide", costoUsd: 0.005 },
    ),
    r(
      "r-4",
      "c-07",
      "cv-02",
      "D",
      202,
      "Lo mandan a Moreno? Pago cuando llega",
      `Sí: Moreno es zona 2 de la mensajería y podés pagar al recibir. El envío sale ${pesos(det("V-1047").envio)} más ${pesos(det("V-1047").embalaje)} de embalaje.`,
      [
        {
          nombre: "cotizar_envio",
          detalle: `Moreno · mensajería zona 2 · ${pesos(det("V-1047").envio + det("V-1047").embalaje)} · C-2228`,
        },
      ],
      { calificacion: "buena" },
    ),
    r(
      "r-5",
      "c-11",
      "cv-07",
      "F",
      149,
      "Hola, me llegó el pedido pero me faltan las less 😕",
      "Uy, perdón Brenda. Para resolverlo rápido, ¿me mandás el video de cuando abriste el paquete? Con eso Lucía lo revisa hoy.",
      [
        { nombre: "crear_reclamo", detalle: "R-0231 · tipo 1, falta mercadería · V-1042" },
        { nombre: "derivar", detalle: "Lucía · post-venta" },
      ],
      { derivo: true, motivoDerivacion: "Reclamo o enojo" },
    ),
    r(
      "r-6",
      "c-17",
      "cv-03",
      "D",
      341,
      "Hola! Quiero 3 docenas de medias largas de nene y una de las 3/4 de hombre",
      `El mínimo mayorista es ${pesos(PEDIDO_MINIMO)} sin envío: te faltan ${pesos(det("V-1046").faltaParaMinimo)}. Lo completás con lo que quieras y va en el mismo pedido.`,
      [
        { nombre: "armar_pedido", detalle: `V-1046 · ${pesos(det("V-1046").mercaderia)} en mercadería` },
        { nombre: "ver_stock", detalle: "MLN10-12 y MTNH4-12 con stock" },
      ],
    ),
    r(
      "r-7",
      "c-12",
      "cv-08",
      "B",
      DAY + 181,
      "Genial. Si llevo 6 me hacés precio?",
      "Los precios son los de la lista mayorista y no puedo hacer descuentos, pero te paso con alguien del equipo para que lo vea.",
      [{ nombre: "derivar", detalle: "Pide un descuento; el bot no hace descuentos" }],
      { derivo: true, motivoDerivacion: "Precio o descuento especial" },
    ),
    r(
      "r-8",
      "c-03",
      "cv-09",
      "D",
      5 * HOUR,
      "Gracias!!",
      "¡Listo Micaela! Tu pedido V-1048 salió por Vía Cargo, guía 4471-2209. Lo retirás en la sucursal de Rosario desde mañana.",
      [{ nombre: "estado_pedido", detalle: "V-1048 · despachado · Vía Cargo" }],
    ),
  ];
}

const getRespuestas = defineStore("bot-respuestas", (now) => respuestasSeed(now));

function configSeed(now: number): Omit<BotConfig, "generadoEn"> {
  return {
    versiones: {
      publicada: { numero: 7, publicadaEn: isoAgo(3 * DAY, now), por: "Elías", acierto: 0.89 },
      borrador: {
        numero: 8,
        editadoEn: isoAgo(2 * HOUR, now),
        por: "Elías",
        cambios: ["Pregunta frecuente nueva: retiro por el local", "Texto nuevo para la palanca “Se está acabando”"],
      },
      historial: [
        {
          numero: 7,
          fecha: isoAgo(3 * DAY, now),
          por: "Elías",
          resumen: "Mensajes de cierre más cortos",
          acierto: 0.89,
        },
        {
          numero: 6,
          fecha: isoAgo(9 * DAY, now),
          por: "Elías",
          resumen: "Vía Cargo solo para el interior",
          acierto: 0.87,
        },
        {
          numero: 5,
          fecha: isoAgo(16 * DAY, now),
          por: "Más Uno",
          resumen: "Primera versión, en modo sombra",
          acierto: 0.82,
        },
      ],
    },
    identidad: {
      nombre: "Asistente VX3",
      trato: "vos",
      emojis: "pocos",
      guia: "Amable, cercano y femenino. Presión sutil sí, agresiva nunca. No es copiar y pegar: no le mandes el mismo texto a todas. Mensajes cortos, de a una idea.",
      suena: [
        "¡Hola Romi! Te lo armo ya. ¿Va por mensajería como siempre?",
        "Te aviso que del conjunto AmorArma quedan pocas en negro y bordó.",
      ],
      noSuena: ["Estimada clienta, le informamos que su pedido…", "¡¡ÚLTIMAS UNIDADES!! ¡¡COMPRÁ YA!!"],
    },
    reglas: {
      pedidoMinimo: PEDIDO_MINIMO,
      senaRetiro: 0.1,
      corteDespachoAmba: "11:00",
      horarioDesde: "09:00",
      horarioHasta: "20:00",
      diasAtencion: "Lunes a sábado",
      mediosPago: [
        { id: "transferencia", activo: true },
        { id: "contraentrega", activo: true },
        { id: "efectivo", activo: true },
        { id: "tarjeta", activo: false },
      ],
      matriz: [
        { transporte: "mensajeria", zona: "amba_1", pagos: ["transferencia", "contraentrega"] },
        { transporte: "mensajeria", zona: "amba_2", pagos: ["transferencia", "contraentrega"] },
        { transporte: "mensajeria", zona: "interior", pagos: [] },
        { transporte: "correo", zona: "amba_1", pagos: ["transferencia"] },
        { transporte: "correo", zona: "amba_2", pagos: ["transferencia"] },
        { transporte: "correo", zona: "interior", pagos: ["transferencia"] },
        { transporte: "via_cargo", zona: "amba_1", pagos: [] },
        { transporte: "via_cargo", zona: "amba_2", pagos: [] },
        { transporte: "via_cargo", zona: "interior", pagos: ["transferencia"] },
        { transporte: "retira", zona: "amba_1", pagos: ["transferencia", "efectivo"] },
        { transporte: "retira", zona: "amba_2", pagos: ["transferencia", "efectivo"] },
        { transporte: "retira", zona: "interior", pagos: ["transferencia", "efectivo"] },
      ],
    },
    preguntas: [
      {
        id: "fq-1",
        pregunta: "¿Cómo compro?",
        respuesta:
          "Elegís los productos en la vidriera o me decís qué querés, y te armo el pedido acá. El mínimo es $ 45.000 sin envío.",
      },
      {
        id: "fq-2",
        pregunta: "¿Hacen envíos a todo el país?",
        respuesta:
          "Sí. En AMBA por mensajería, y podés pagar al recibir. Al interior, por Correo Argentino o Vía Cargo.",
      },
      {
        id: "fq-3",
        pregunta: "¿Puedo cambiar un producto?",
        respuesta:
          "Si hubo un error nuestro, lo resolvemos siempre. Si no era lo que esperabas, no hay cambio: por eso te mandamos las fotos reales.",
      },
      {
        id: "fq-4",
        pregunta: "¿Puedo retirar por el local?",
        respuesta: "Sí, con una seña del 10 % del total. El resto lo pagás al retirar.",
      },
    ],
    palancas: [
      {
        id: "despacho",
        nombre: "Despacho hoy",
        condicion: "AMBA, antes del corte de las 11:00 o con tiempo para el Correo de la tarde",
        ejemplo: "Si lo cerramos ahora, sale hoy mismo 🚚",
        activa: true,
      },
      {
        id: "acaba",
        nombre: "Se está acabando",
        condicion: "Stock crítico o mucho movimiento del producto",
        ejemplo: "Te aviso que de este quedan pocas medias docenas.",
        activa: true,
      },
      {
        id: "guardar",
        nombre: "No puedo guardarlo mucho",
        condicion: "Pedido armado hace horas sin confirmar",
        ejemplo: "Te lo tengo reservado hasta mañana a la mañana.",
        activa: true,
      },
    ],
    secuencia: [
      {
        paso: "1.º mensaje",
        cuando: "A los 30 minutos sin respuesta",
        accion: "Primero responde lo pendiente; después, una palanca",
      },
      { paso: "2.º mensaje", cuando: "Esa misma tarde", accion: "Otra palanca, sin repetir el texto" },
      { paso: "3.º mensaje", cuando: "La mañana siguiente", accion: "Último aviso, sin insistir después" },
      { paso: "Anulación", cuando: "A las 24 h sin respuesta", accion: "Anula el pedido y libera la reserva de stock" },
    ],
    derivacion: [
      { id: "dv-1", cuando: "Reclamo o enojo", a: "Lucía · post-venta", activa: true },
      { id: "dv-2", cuando: "Pedido de más de 10 bultos", a: "Elías", activa: true },
      { id: "dv-3", cuando: "La clienta pide hablar con una persona", a: "Leo · ventas", activa: true },
      { id: "dv-4", cuando: "El comprobante no coincide con el total", a: "Leo · cobros", activa: true },
      { id: "dv-5", cuando: "El bot no está seguro de la respuesta", a: "Leo · ventas", activa: true },
    ],
    limites: [
      "Nunca hace descuentos ni da precios distintos a la lista",
      "Nunca promete plazos que no estén estipulados",
      "Nunca afirma stock sin verificarlo",
      "Nunca ofrece contraentrega fuera de AMBA o sin mensajería",
      "No habla de temas que no sean de VX3",
    ],
  };
}

const getConfig = defineStore("bot-config", (now) => configSeed(now));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Probador: respuestas de ejemplo según lo que pregunta (sin llamar al modelo). */
function probar(mensaje: string): BotPrueba {
  const texto = mensaje.toLowerCase();
  const conjunto = getProducto("CJATN14");

  if (/descuento|rebaja|precio especial|me hac[eé]s precio/.test(texto)) {
    return {
      respuesta:
        "Los precios son los de la lista mayorista y no puedo hacer descuentos, pero te paso con alguien del equipo para que lo vea.",
      herramientas: [{ nombre: "derivar", detalle: "Leo · ventas · motivo: precio o descuento especial" }],
      derivaria: true,
    };
  }
  if (/reclamo|falt|roto|fallad|mancha/.test(texto)) {
    return {
      respuesta:
        "Uy, perdón. Para resolverlo rápido, ¿me mandás el video de cuando abriste el paquete? Con eso lo revisa Lucía hoy.",
      herramientas: [
        { nombre: "crear_reclamo", detalle: "Reclamo nuevo, vinculado al último pedido" },
        { nombre: "derivar", detalle: "Lucía · post-venta" },
      ],
      derivaria: true,
    };
  }
  if (/m[ií]nimo/.test(texto)) {
    return {
      respuesta: `El mínimo mayorista es ${pesos(PEDIDO_MINIMO)} sin envío. Si te falta un poco, lo completás con lo que quieras y va en el mismo pedido.`,
      herramientas: [],
      derivaria: false,
    };
  }
  if (/env[ií]o|mand[aá]n|llega|correo|mensajer/.test(texto)) {
    return {
      respuesta: `Si sos de AMBA va por mensajería y podés pagar al recibir (zona 1: ${pesos(4_500)} más embalaje). Al interior va por Correo Argentino: pasame tu código postal y te lo cotizo.`,
      herramientas: [{ nombre: "cotizar_envio", detalle: "Pide el código postal para cotizar bulto por bulto" }],
      derivaria: false,
    };
  }
  if (/talle|curva|\b(9\d|1[01]\d)\b/.test(texto)) {
    return {
      respuesta: `Sí, el conjunto AmorArma viene en curva ${conjunto.talles}, así que ese talle está en cada media docena. ¿Te paso las fotos?`,
      herramientas: [{ nombre: "buscar_producto", detalle: "Conjuntos con talle en la curva" }],
      derivaria: false,
    };
  }
  if (/precio|cu[aá]nto|sale|vale/.test(texto)) {
    return {
      respuesta: `La media docena del conjunto armado tres piezas AmorArma está ${precio("CJATN14")}, en los colores y diseños de la foto. Hoy hay stock.`,
      herramientas: [
        { nombre: "ver_producto", detalle: "CJATN14 · lista MAYORISTA EF/TR" },
        { nombre: "ver_stock", detalle: `CJATN14-6 · ${bultosDisponibles(conjunto)} bultos disponibles` },
      ],
      derivaria: false,
    };
  }
  return {
    respuesta: "¡Hola! Contame qué estás buscando (producto, talle o color) y te paso las opciones con foto y precio.",
    herramientas: [{ nombre: "buscar_producto", detalle: "Sin filtros todavía: pide más datos" }],
    derivaria: false,
  };
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/bot\/rendimiento$/, handler: () => Response.json(rendimiento()) },
  {
    method: "GET",
    pattern: /^\/bot\/respuestas$/,
    handler: () =>
      Response.json({
        generadoEn: new Date().toISOString(),
        respuestas: getRespuestas().toSorted((a, b) => b.respondidaEn.localeCompare(a.respondidaEn)),
      }),
  },
  {
    method: "POST",
    pattern: /^\/bot\/respuestas\/([^/]+)\/calificar$/,
    handler: async ({ params: [id], request }) => {
      const respuesta = getRespuestas().find((item) => item.id === decodeURIComponent(id));
      if (!respuesta) return errorResponse(404, `No existe la respuesta ${id}.`);
      const { calificacion } = await readJson<{ calificacion: "buena" | "mala" }>(request);
      if (calificacion !== "buena" && calificacion !== "mala") return errorResponse(422, "Calificación inválida.");
      respuesta.calificacion = calificacion;
      return Response.json(respuesta);
    },
  },
  {
    method: "GET",
    pattern: /^\/bot\/config$/,
    handler: () => Response.json({ ...getConfig(), generadoEn: new Date().toISOString() }),
  },
  {
    method: "PUT",
    pattern: /^\/bot\/config$/,
    handler: async ({ request }) => {
      const config = getConfig();
      const body = await readJson<Omit<BotConfig, "versiones" | "generadoEn">>(request);
      if (body.reglas && body.reglas.pedidoMinimo !== undefined && body.reglas.pedidoMinimo <= 0) {
        return errorResponse(422, "El pedido mínimo tiene que ser mayor a $ 0.");
      }
      Object.assign(config, {
        identidad: body.identidad ?? config.identidad,
        reglas: body.reglas ?? config.reglas,
        preguntas: body.preguntas ?? config.preguntas,
        palancas: body.palancas ?? config.palancas,
        secuencia: body.secuencia ?? config.secuencia,
        derivacion: body.derivacion ?? config.derivacion,
        limites: body.limites ?? config.limites,
      });
      config.versiones.borrador = {
        numero: config.versiones.publicada.numero + 1,
        editadoEn: new Date().toISOString(),
        por: "Elías",
        cambios: [...(config.versiones.borrador?.cambios ?? []), "Cambios guardados desde la consola"].slice(-4),
      };
      return Response.json({ ...config, generadoEn: new Date().toISOString() });
    },
  },
  {
    method: "POST",
    pattern: /^\/bot\/config\/publicar$/,
    handler: async () => {
      const config = getConfig();
      // Antes de publicar se corre el set de evaluación (RF-M3-10).
      await wait(1_400);
      const numero = config.versiones.borrador?.numero ?? config.versiones.publicada.numero + 1;
      const resultado: BotPublicacion = { numero, acierto: 0.9, casos: 412, aprobados: 371 };
      const fecha = new Date().toISOString();
      config.versiones.historial.unshift({
        numero,
        fecha,
        por: "Elías",
        resumen: config.versiones.borrador?.cambios[0] ?? "Ajustes de configuración",
        acierto: resultado.acierto,
      });
      config.versiones.publicada = { numero, publicadaEn: fecha, por: "Elías", acierto: resultado.acierto };
      config.versiones.borrador = null;
      return Response.json(resultado);
    },
  },
  {
    method: "POST",
    pattern: /^\/bot\/probar$/,
    handler: async ({ request }) => {
      const { mensaje } = await readJson<{ mensaje: string }>(request);
      if (!mensaje?.trim()) return errorResponse(422, "Escribí un mensaje para probar.");
      return Response.json(probar(mensaje));
    },
  },
];
