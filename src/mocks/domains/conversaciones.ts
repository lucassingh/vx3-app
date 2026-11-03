import type {
  BandejaConversaciones,
  Conversacion,
  EstadoConversacion,
  EtapaConversacion,
  FichaEnConversacion,
  LineaWhatsapp,
  MensajeConversacion,
  NuevoMensaje,
  OrigenConversacion,
  PlantillaWhatsapp,
  ReclamoEnFicha,
  RespuestaRapida,
} from "@/lib/api/types";
import { formatCurrency, primerNombre } from "@/lib/format";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route, type RouteParams } from "../http";
import {
  bultosDisponibles,
  DAY,
  detalleDe,
  getAnuncio,
  getClienta,
  getPedido,
  getProducto,
  isoAgo,
  pedidos,
  PEDIDO_MINIMO,
  presentacionesDe,
} from "../seed";

/**
 * M11 · Conversaciones. Cada conversación está atada a una clienta y a sus
 * pedidos de la semilla: los montos salen del motor de precios, así que el
 * chat, el pedido y la factura dicen lo mismo.
 */

/** Usuario que opera la bandeja en la demo. */
const YO = "Elías";

type SinMeta<T> = T extends unknown ? Omit<T, "id" | "enviadoEn"> : never;
type Borrador = SinMeta<MensajeConversacion> & { hace: number };

type ConversacionSeed = {
  id: string;
  clientaId: string;
  linea: LineaWhatsapp;
  estado: EstadoConversacion;
  etapa: EtapaConversacion;
  origen: OrigenConversacion["tipo"];
  anuncioId?: string;
  asignadaA: string | null;
  sinLeer: number;
  motivo: string | null;
  pedidoAbiertoId: string | null;
  reclamoAbierto: boolean;
  mensajes: Borrador[];
};

/* ---- Constructores de mensajes ------------------------------------------- */

const pesos = (value: number) => formatCurrency(value);

const clienta = (hace: number, texto: string): Borrador => ({ hace, tipo: "texto", autor: "clienta", texto });
const bot = (hace: number, texto: string): Borrador => ({ hace, tipo: "texto", autor: "bot", texto });
const persona = (hace: number, autorNombre: string, texto: string): Borrador => ({
  hace,
  tipo: "texto",
  autor: "persona",
  autorNombre,
  texto,
});
const nota = (hace: number, autorNombre: string, texto: string): Borrador => ({
  hace,
  tipo: "nota",
  autorNombre,
  texto,
});
const sistema = (
  hace: number,
  evento: Extract<MensajeConversacion, { tipo: "sistema" }>["evento"],
  texto: string,
): Borrador => ({ hace, tipo: "sistema", evento, texto });

function producto(hace: number, sku: string, autor: "bot" | "persona" = "bot"): Borrador {
  const item = getProducto(sku);
  const { bulto } = presentacionesDe(item);
  return {
    hace,
    tipo: "producto",
    autor,
    sku,
    nombre: item.nombre,
    colores: item.colores,
    presentacion: bulto.label,
    precio: bulto.precio,
    stockBultos: bultosDisponibles(item),
    link: `vx3.com.ar/p/${sku}`,
  };
}

function comprobante(
  hace: number,
  pedidoId: string,
  datos: { banco: string; titular: string; operacion: string; diferencia?: number },
): Borrador {
  const { total } = detalleDe(getPedido(pedidoId));
  return {
    hace,
    tipo: "comprobante",
    monto: total - (datos.diferencia ?? 0),
    banco: datos.banco,
    titular: datos.titular,
    operacion: datos.operacion,
    pedidoId,
    totalPedido: total,
  };
}

const precioBulto = (sku: string) => pesos(presentacionesDe(getProducto(sku)).bulto.precio);

/** Mensaje del bot cuando el pedido no llega al mínimo (RN-77): dice cuánto falta exacto. */
function minimo(pedidoId: string, siFalta: (falta: string) => string, siLlega: string) {
  const { faltaParaMinimo } = detalleDe(getPedido(pedidoId));
  return faltaParaMinimo > 0 ? siFalta(pesos(faltaParaMinimo)) : siLlega;
}

const anuncioTexto = (id: string) => {
  const anuncio = getAnuncio(id);
  return `Llegó desde el anuncio “${anuncio.nombre}” · ${anuncio.campana}`;
};

const det = (id: string) => detalleDe(getPedido(id));

/* ---- Conversaciones ------------------------------------------------------- */

const seed = (): ConversacionSeed[] => [
  {
    id: "cv-01",
    clientaId: "c-05",
    linea: "ventas",
    estado: "bot",
    etapa: "pedido",
    origen: "anuncio",
    anuncioId: "a-02",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: "V-1059",
    reclamoAbierto: false,
    mensajes: [
      sistema(34, "anuncio", anuncioTexto("a-02")),
      clienta(34, "Hola! quiero info de los corpiños del anuncio 😍"),
      bot(
        34,
        `¡Hola Celeste! Sí, es el corpiño armado Smart Sexy con aro y push up, curva 85 a 100, colores sujetos a stock. La media docena está ${precioBulto("CAN9")} y hoy hay stock 🙌`,
      ),
      producto(34, "CAN9"),
      clienta(31, "Me encanta. Tenés vedetinas que combinen?"),
      bot(30, "Te paso una que sale mucho con ese corpiño: la vedetina morley de algodón Sakura, curva M a XL."),
      producto(30, "VN25"),
      clienta(27, "Dale, mandame 1 de corpiños y 2 de vedetinas. Soy de Córdoba capital, CP 5000"),
      sistema(
        26,
        "pedido",
        `El bot armó el pedido V-1059 · ${pesos(det("V-1059").mercaderia)} en mercadería · reserva el stock hasta mañana`,
      ),
      bot(
        26,
        minimo(
          "V-1059",
          (falta) =>
            `Te armé el pedido V-1059. El mínimo mayorista es ${pesos(PEDIDO_MINIMO)} sin envío y te faltan ${falta}. ¿Sumamos otra media docena de corpiños o algún conjunto? Va en el mismo pedido.`,
          "Te armé el pedido V-1059. Para Córdoba va por Correo Argentino: ¿lo querés a domicilio o a sucursal?",
        ),
      ),
    ],
  },
  {
    id: "cv-02",
    clientaId: "c-07",
    linea: "ventas",
    estado: "bot",
    etapa: "cotizo",
    origen: "anuncio",
    anuncioId: "a-01",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: "V-1047",
    reclamoAbierto: false,
    mensajes: [
      sistema(206, "anuncio", anuncioTexto("a-01")),
      clienta(206, "Hola! info de este conjunto 😍"),
      bot(
        206,
        `¡Hola! Sí, es el conjunto armado tres piezas AmorArma con aro y push up, curva 90 a 105, en los colores y diseños de la foto. La media docena está ${precioBulto("CJATN14")} y hoy hay stock.`,
      ),
      producto(206, "CJATN14"),
      clienta(203, "Lo mandan a Moreno? Pago cuando llega"),
      bot(
        202,
        `Sí: Moreno es zona 2 de la mensajería y podés pagar al recibir. El envío sale ${pesos(det("V-1047").envio)} más ${pesos(det("V-1047").embalaje)} de embalaje. ¿Te lo armo?`,
      ),
      sistema(
        202,
        "envio",
        `El bot cotizó el envío · Mensajería zona 2 · ${pesos(det("V-1047").envio + det("V-1047").embalaje)} · cotización C-2228`,
      ),
      clienta(201, "Si, y sumame unas less de las de encaje"),
      sistema(200, "pedido", `El bot armó el pedido V-1047 · ${pesos(det("V-1047").mercaderia)} en mercadería`),
      bot(
        200,
        minimo(
          "V-1047",
          (falta) =>
            `Listo, te armé el pedido V-1047. Para llegar al mínimo de ${pesos(PEDIDO_MINIMO)} te faltan ${falta}: ¿sumamos otra media docena de less o un corpiño?`,
          "Listo, te armé el pedido V-1047. ¿Lo confirmamos así sale en el próximo despacho?",
        ),
      ),
      sistema(170, "seguimiento", "Seguimiento 1 de 3 · 30 min sin respuesta · palanca: despacho hoy"),
      bot(170, "Yanina, si lo cerramos en la próxima hora sale en el despacho de hoy para Moreno 🚚"),
      sistema(45, "seguimiento", "Seguimiento 2 de 3 · palanca: se está acabando"),
      bot(45, "Te aviso que del conjunto AmorArma quedan pocas medias docenas en negro y bordó. ¿Te lo guardo?"),
      sistema(
        44,
        "seguimiento",
        "Próximo: seguimiento 3 mañana a la mañana. Si no responde, el pedido se anula a las 24 h y libera el stock.",
      ),
    ],
  },
  {
    id: "cv-03",
    clientaId: "c-17",
    linea: "ventas",
    estado: "bot",
    etapa: "pedido",
    origen: "recompra",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: "V-1046",
    reclamoAbierto: false,
    mensajes: [
      clienta(342, "Hola! Quiero 3 docenas de medias largas de nene y una de las 3/4 de hombre"),
      bot(
        341,
        `¡Hola Gisela, qué bueno tenerte de vuelta! Te armé 3 docenas de media larga de niño Altomax (${precioBulto("MLN10")} cada una) y 1 docena de medias 3/4 MD de hombre (${precioBulto("MTNH4")}).`,
      ),
      sistema(341, "pedido", `El bot armó el pedido V-1046 · ${pesos(det("V-1046").mercaderia)} en mercadería`),
      bot(
        341,
        minimo(
          "V-1046",
          (falta) =>
            `El mínimo mayorista es ${pesos(PEDIDO_MINIMO)} sin envío: te faltan ${falta}. Lo completás con lo que quieras y va en el mismo pedido, no hace falta armar otro.`,
          "¿Va por mensajería a Florencio Varela como la última vez?",
        ),
      ),
      {
        hace: 318,
        tipo: "audio",
        duracion: "0:14",
        transcripcion: "Ay no sabía lo del mínimo. Dejame ver qué más necesito y te digo, capaz unos boxer de mujer.",
      },
      bot(
        317,
        `¡Dale! Si buscás boxer, el de microfibra Smart Sexy sale mucho. La media docena está ${precioBulto("BMN1")}.`,
      ),
      producto(317, "BMN1"),
      sistema(287, "seguimiento", "Seguimiento 1 de 3 · palanca: no puedo guardarlo mucho"),
      bot(287, "Gisela, te tengo las medias reservadas hasta mañana a la mañana. ¿Le sumamos los boxer y lo cerramos?"),
    ],
  },
  {
    id: "cv-04",
    clientaId: "c-01",
    linea: "ventas",
    estado: "persona",
    etapa: "cerro",
    origen: "recompra",
    asignadaA: "Leo",
    sinLeer: 1,
    motivo: "Clienta top",
    pedidoAbiertoId: "V-1055",
    reclamoAbierto: false,
    mensajes: [
      clienta(
        112,
        "Hola! Te paso lo de esta semana: 2 del conjunto AmorArma, 1 de vedetinas segunda piel y 2 de less Jenifer",
      ),
      sistema(111, "toma", "Leo tomó la conversación · motivo: clienta top · el bot se apartó"),
      persona(109, "Leo", "¡Hola Romi! Ya te lo armo. ¿Va por mensajería a Lanús como siempre?"),
      clienta(106, "Siii. Te transfiero ahora"),
      sistema(104, "pedido", `Leo creó el pedido V-1055 · ${pesos(det("V-1055").total)} con envío`),
      comprobante(98, "V-1055", { banco: "Supervielle", titular: "Romina B. Gaitán", operacion: "0004812733" }),
      sistema(97, "pedido", "Comprobante asociado a V-1055 · el monto coincide · listo para facturar"),
      persona(96, "Leo", "Recibido, gracias! Sale hoy 🙌"),
      clienta(95, "Gracias Leo!!"),
    ],
  },
  {
    id: "cv-05",
    clientaId: "c-09",
    linea: "ventas",
    estado: "bot",
    etapa: "cerro",
    origen: "anuncio",
    anuncioId: "a-04",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: "V-1058",
    reclamoAbierto: false,
    mensajes: [
      sistema(75, "anuncio", anuncioTexto("a-04")),
      clienta(75, "Hola, vi el conjunto Condeza. Tenés en talle 100?"),
      bot(
        75,
        "¡Hola Natalia! Sí: el conjunto Condeza viene en curva 85 a 105, así que el 100 está en cada media docena. Te dejo el link para verlo completo y armar tu pedido.",
      ),
      producto(75, "CJATN31"),
      sistema(62, "vidriera", "Abrió el link de la vidriera y armó un carrito · reserva interna de stock"),
      clienta(41, "Hola! Te paso mi pedido #V-1058"),
      sistema(41, "vidriera", "Pedido V-1058 de la vidriera vinculado a esta conversación"),
      bot(
        40,
        `¡Recibido! Conjunto Condeza y less Jenifer. Va por mensajería a Avellaneda (zona 1) y pagás al recibir: el total es ${pesos(det("V-1058").total)} con envío. Sale en el próximo despacho.`,
      ),
      sistema(
        40,
        "envio",
        `Cotización C-2233 · Mensajería zona 1 · ${pesos(det("V-1058").envio + det("V-1058").embalaje)} · guardada en el pedido`,
      ),
      clienta(39, "Perfecto, gracias!"),
    ],
  },
  {
    id: "cv-06",
    clientaId: "c-21",
    linea: "ventas",
    estado: "esperando",
    etapa: "cotizo",
    origen: "anuncio",
    anuncioId: "a-03",
    asignadaA: null,
    sinLeer: 1,
    motivo: "El comprobante no coincide con el total",
    pedidoAbiertoId: "V-1054",
    reclamoAbierto: false,
    mensajes: [
      sistema(135, "anuncio", anuncioTexto("a-03")),
      clienta(135, "Buenas! Precio de las vedetinas sin costura?"),
      bot(
        134,
        `¡Hola Paola! Son las vedetinas segunda piel Linda Luna, curva M a XXL. La media docena está ${precioBulto("VN16")}.`,
      ),
      producto(134, "VN16"),
      clienta(132, "Quiero 2 de esas y 1 de las morley talle grande. Mando a Posadas, Misiones"),
      bot(
        131,
        `Para Posadas va por Correo Argentino a domicilio. Te coticé el envío: ${pesos(det("V-1054").envio)} más ${pesos(det("V-1054").embalaje)} de embalaje. El total queda en ${pesos(det("V-1054").total)}.`,
      ),
      sistema(
        131,
        "envio",
        `El bot cotizó el envío · Correo Argentino a domicilio · ${pesos(det("V-1054").envio)} · cotización C-2231 · vence mañana`,
      ),
      bot(
        128,
        "Te paso los datos para transferir. Cuando tengas el comprobante, mandámelo por acá y lo asocio a tu pedido V-1054.",
      ),
      comprobante(22, "V-1054", {
        banco: "Santander",
        titular: "Gustavo Ibáñez",
        operacion: "7730291845",
        diferencia: 500,
      }),
      sistema(
        21,
        "derivacion",
        "Derivada a una persona · motivo: el comprobante no coincide con el total (diferencia de $ 500)",
      ),
      bot(20, "¡Gracias Paola! Ya lo recibí. Una persona del equipo lo revisa y te confirma en un ratito."),
    ],
  },
  {
    id: "cv-07",
    clientaId: "c-11",
    linea: "local",
    estado: "persona",
    etapa: "cerro",
    origen: "organico",
    asignadaA: "Lucía",
    sinLeer: 1,
    motivo: "Reclamo",
    pedidoAbiertoId: null,
    reclamoAbierto: true,
    mensajes: [
      clienta(150, "Hola, me llegó el pedido pero en la media docena de less vinieron 5 😕"),
      bot(
        149,
        "Uy, perdón Brenda. Para resolverlo rápido, ¿me mandás el video de cuando abriste el paquete? Con eso Lucía lo revisa hoy.",
      ),
      {
        hace: 140,
        tipo: "adjunto",
        formato: "video",
        titulo: "Video de apertura del paquete",
        detalle: "0:42 · pedido V-1042",
      },
      sistema(139, "reclamo", "Reclamo R-0231 creado · tipo 1, falta mercadería · pedido V-1042 · responder en 24 h"),
      sistema(139, "derivacion", "Derivada a Lucía · motivo: reclamo"),
      nota(
        118,
        "Lucía",
        "En el video se ven 5 less. Corresponde reintegrar una prenda: el bulto ÷ 6 (tipo 1, nunca se reenvía). Origen probable: armado.",
      ),
      persona(
        116,
        "Lucía",
        `Hola Brenda, soy Lucía. Ya vi el video y tenés razón, te pido disculpas. Te reintegramos ${precioBulto("LN35")} por las less. ¿Te lo transferimos o preferís dejarlo a cuenta del próximo pedido?`,
      ),
      clienta(64, "A cuenta del próximo está bien, gracias!"),
    ],
  },
  {
    id: "cv-08",
    clientaId: "c-12",
    linea: "ventas",
    estado: "esperando",
    etapa: "producto",
    origen: "recompra",
    asignadaA: null,
    sinLeer: 2,
    motivo: "Pide un precio especial",
    pedidoAbiertoId: null,
    reclamoAbierto: false,
    mensajes: [
      clienta(DAY + 190, "Hola! Tenés las vedetinas morley de talle grande? Las de la otra vez"),
      bot(
        DAY + 189,
        `¡Hola Soledad! Sí, la vedetina morley Need Feel talles grandes, curva L a XXL. La media docena está ${precioBulto("VN31")}.`,
      ),
      producto(DAY + 189, "VN31"),
      clienta(DAY + 182, "Genial. Si llevo 6 me hacés precio?"),
      bot(
        DAY + 181,
        "Los precios son los de la lista mayorista y no puedo hacer descuentos, pero te paso con alguien del equipo para que lo vea.",
      ),
      sistema(
        DAY + 181,
        "derivacion",
        "Derivada a una persona · motivo: pide un precio especial (el bot no hace descuentos)",
      ),
    ],
  },
  {
    id: "cv-09",
    clientaId: "c-03",
    linea: "ventas",
    estado: "cerrada",
    etapa: "cerro",
    origen: "recompra",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: null,
    reclamoAbierto: false,
    mensajes: [
      clienta(420, "Hola! Mandame 2 de vedetinas segunda piel, 1 de less talle grande y 1 de corpiños push up"),
      bot(
        419,
        `¡Hola Micaela! Te armé el pedido: total ${pesos(det("V-1048").total)}. Para Rosario va por Vía Cargo y el flete lo pagás al retirar en la sucursal.`,
      ),
      sistema(419, "pedido", "El bot armó el pedido V-1048 · Vía Cargo · paga el flete al retirar"),
      comprobante(400, "V-1048", { banco: "Santander", titular: "Micaela Roldán", operacion: "5518220047" }),
      sistema(399, "pedido", "Comprobante asociado a V-1048 · el monto coincide"),
      sistema(300, "envio", "Despachado por Vía Cargo · guía 4471-2209"),
      bot(
        299,
        "¡Listo Micaela! Tu pedido V-1048 salió por Vía Cargo, guía 4471-2209. Lo retirás en la sucursal de Rosario desde mañana. Seguilo acá: vx3.com.ar/s/V-1048 💛",
      ),
      clienta(290, "Gracias!!"),
      sistema(289, "cierre", "Conversación cerrada por el bot"),
    ],
  },
  {
    id: "cv-10",
    clientaId: "c-19",
    linea: "ventas",
    estado: "bot",
    etapa: "cerro",
    origen: "anuncio",
    anuncioId: "a-04",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: "V-1050",
    reclamoAbierto: false,
    mensajes: [
      clienta(14, "Hola! Cuándo me llega el pedido?"),
      bot(
        14,
        "¡Hola Antonella! Tu pedido V-1050 ya está facturado y lo están armando. Sale hoy por la mensajería a San Martín y te llega entre hoy y mañana. Apenas se despache te mando el link de seguimiento.",
      ),
      clienta(12, "Genial, gracias 💖"),
    ],
  },
  {
    id: "cv-11",
    clientaId: "c-13",
    linea: "ventas",
    estado: "esperando",
    etapa: "consulto",
    origen: "recompra",
    asignadaA: YO,
    sinLeer: 1,
    motivo: "Pedido grande",
    pedidoAbiertoId: null,
    reclamoAbierto: false,
    mensajes: [
      clienta(
        26,
        "Hola! Elías, me hacés precio por 10 medias docenas del conjunto AmorArma? Es para una feria del fin de semana",
      ),
      bot(26, "¡Hola Mariela! Para un pedido así te paso con Elías, que lo ve con vos."),
      sistema(26, "derivacion", "Derivada a Elías · motivo: pedido grande (10 medias docenas)"),
    ],
  },
  {
    id: "cv-12",
    clientaId: "c-02",
    linea: "ventas",
    estado: "bot",
    etapa: "cerro",
    origen: "recompra",
    asignadaA: null,
    sinLeer: 0,
    motivo: null,
    pedidoAbiertoId: "V-1057",
    reclamoAbierto: false,
    mensajes: [
      clienta(58, "Hola! Otra vez yo jaja. Mandame 2 docenas de medias largas, 1 de soquetes y 2 de less Jenifer"),
      bot(
        57,
        `¡Hola Daiana! Te lo armo. Va por mensajería a González Catán (zona 2) y pagás al recibir: envío ${pesos(det("V-1057").envio)} más ${pesos(det("V-1057").embalaje)} de embalaje.`,
      ),
      sistema(
        57,
        "envio",
        `El bot cotizó el envío · Mensajería zona 2 · ${pesos(det("V-1057").envio + det("V-1057").embalaje)} · cotización C-2235`,
      ),
      clienta(56, "Si dale"),
      sistema(55, "pedido", "Pedido V-1057 confirmado · contraentrega · listo para facturar"),
      bot(
        55,
        `¡Listo, Daiana! Tu pedido V-1057 sale en el próximo despacho. La mensajería entrega de lunes a sábado de 9 a 18 y pagás ${pesos(det("V-1057").total)} al recibir. Te mando el seguimiento cuando salga 🚚`,
      ),
      clienta(54, "Graciaas"),
    ],
  },
];

/** Reclamos de cada clienta (el módulo de post-venta es la fuente; acá, lo que muestra la ficha). */
const RECLAMOS: Record<string, ReclamoEnFicha[]> = {
  "c-11": [{ id: "R-0231", tipo: "Falta mercadería", pedidoId: "V-1042", estado: "abierto" }],
  "c-01": [{ id: "R-0152", tipo: "Producto equivocado", pedidoId: "V-0988", estado: "resuelto" }],
  "c-12": [{ id: "R-0164", tipo: "Mal enviado por Correo", pedidoId: "V-0951", estado: "resuelto" }],
};

export const respuestasRapidas: RespuestaRapida[] = [
  {
    id: "rr-1",
    titulo: "Datos para transferir",
    texto:
      "Te paso los datos para transferir. Cuando tengas el comprobante, mandámelo por acá y lo asocio a tu pedido.",
  },
  {
    id: "rr-2",
    titulo: "Mínimo mayorista",
    texto:
      "El mínimo mayorista es $ 45.000 sin envío. Si te falta, lo completás con lo que quieras y va en el mismo pedido.",
  },
  {
    id: "rr-3",
    titulo: "Horarios de entrega",
    texto: "La mensajería entrega de lunes a sábado de 9 a 18. El día del envío te mando el link de seguimiento.",
  },
  {
    id: "rr-4",
    titulo: "Video de apertura",
    texto: "Para resolverlo rápido, ¿me mandás el video de cuando abriste el paquete?",
  },
  {
    id: "rr-5",
    titulo: "Comprobante recibido",
    texto: "¡Recibido! Ya quedó asociado a tu pedido y lo pasamos a facturar.",
  },
];

export const plantillas: PlantillaWhatsapp[] = [
  {
    id: "pl-1",
    nombre: "seguimiento_consulta",
    categoria: "utilidad",
    texto: "Hola {{nombre}}, te escribimos de VX3 por tu consulta. ¿Querés que te armemos el pedido?",
  },
  {
    id: "pl-2",
    nombre: "novedades_recompra",
    categoria: "marketing",
    texto: "Hola {{nombre}}! Entró mercadería nueva de lo que solés llevar. ¿Te pasamos las novedades?",
  },
  {
    id: "pl-3",
    nombre: "aviso_despacho",
    categoria: "utilidad",
    texto: "Hola {{nombre}}, tu pedido ya salió. Te pasamos el seguimiento por acá.",
  },
];

export const motivosToma = [
  "Reclamo o enojo",
  "Pedido grande",
  "Pidió hablar con una persona",
  "El bot no estaba seguro",
  "Precio o descuento especial",
  "Clienta top",
  "Otro",
];

/* ---- Armado de la respuesta ----------------------------------------------- */

function fichaDe(clientaId: string, now: number): FichaEnConversacion {
  const datos = getClienta(clientaId);
  const propios = pedidos
    .filter((pedido) => pedido.clientaId === clientaId)
    .toSorted((a, b) => a.creadoHaceMin - b.creadoHaceMin);
  const total30d = propios
    .filter((pedido) => pedido.estado !== "anulado" && pedido.creadoHaceMin < 30 * DAY)
    .reduce((sum, pedido) => sum + detalleDe(pedido).total, 0);

  return {
    segmento: datos.segmento,
    localidad: datos.localidad,
    provincia: datos.provincia,
    cp: datos.cp,
    zona: datos.zona,
    origen: {
      tipo: datos.origen,
      anuncio: datos.anuncioOrigenId ? getAnuncio(datos.anuncioOrigenId).nombre : undefined,
    },
    clientaDesdeDias: datos.primeraCompraDias,
    pedidosHistoricos: datos.pedidos,
    totalComprado: datos.totalComprado,
    total30d,
    ticketPromedio: Math.round(datos.totalComprado / Math.max(1, datos.pedidos)),
    pedidos: propios.slice(0, 4).map((pedido) => ({
      id: pedido.id,
      estado: pedido.estado,
      canal: pedido.canal,
      transporte: pedido.transporte,
      total: detalleDe(pedido).total,
      creadoEn: isoAgo(pedido.creadoHaceMin, now),
    })),
    reclamos: RECLAMOS[clientaId] ?? [],
  };
}

const esDeClienta = (mensaje: MensajeConversacion) =>
  (mensaje.tipo === "texto" && mensaje.autor === "clienta") ||
  mensaje.tipo === "audio" ||
  mensaje.tipo === "comprobante" ||
  mensaje.tipo === "adjunto";

/** La ventana de 24 h de Meta se abre con cada mensaje de la clienta. */
function ventanaDe(mensajes: MensajeConversacion[], now: number) {
  const ultimo = mensajes.findLast(esDeClienta);
  if (!ultimo) return null;
  const vence = new Date(ultimo.enviadoEn).getTime() + DAY * 60_000;
  return vence > now ? new Date(vence).toISOString() : null;
}

function crear(now: number): Conversacion[] {
  return seed().map(({ clientaId, mensajes, origen, anuncioId, ...conversacion }) => {
    const datos = getClienta(clientaId);
    const lista: MensajeConversacion[] = mensajes.map(({ hace, ...mensaje }, index) => ({
      ...mensaje,
      id: `${conversacion.id}-m${index + 1}`,
      enviadoEn: isoAgo(hace, now),
    })) as MensajeConversacion[];

    return {
      ...conversacion,
      clienta: { id: clientaId, nombre: datos.nombre, telefono: datos.telefono },
      origen: { tipo: origen, anuncio: anuncioId ? getAnuncio(anuncioId).nombre : undefined },
      ventanaHasta: ventanaDe(lista, now),
      mensajes: lista,
      ficha: fichaDe(clientaId, now),
    };
  });
}

const getConversaciones = defineStore("conversaciones", (now) => crear(now));

const ultimaActividad = (conversacion: Conversacion) => conversacion.mensajes.at(-1)?.enviadoEn ?? "";

function bandeja(): BandejaConversaciones {
  return {
    generadoEn: new Date().toISOString(),
    conversaciones: getConversaciones().toSorted((a, b) => ultimaActividad(b).localeCompare(ultimaActividad(a))),
    respuestasRapidas,
    plantillas,
    motivosToma,
  };
}

function find(id: string) {
  return getConversaciones().find((conversacion) => conversacion.id === decodeURIComponent(id));
}

let secuencia = 0;
function agregar(conversacion: Conversacion, mensaje: SinMeta<MensajeConversacion>) {
  secuencia += 1;
  const nuevo = { ...mensaje, id: `${conversacion.id}-n${secuencia}`, enviadoEn: new Date().toISOString() };
  conversacion.mensajes.push(nuevo as MensajeConversacion);
}

/** Acción sobre una conversación existente; 404 si no existe. */
function accion(handler: (conversacion: Conversacion, request: Request) => Response | Promise<Response>) {
  return async ({ params: [id], request }: { params: RouteParams; request: Request }) => {
    const conversacion = find(id);
    if (!conversacion) return errorResponse(404, `No existe la conversación ${id}.`);
    return handler(conversacion, request);
  };
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/conversaciones$/, handler: () => Response.json(bandeja()) },
  {
    method: "POST",
    pattern: /^\/conversaciones\/([^/]+)\/tomar$/,
    handler: accion(async (conversacion, request) => {
      if (conversacion.estado === "cerrada") return errorResponse(409, "La conversación está cerrada.");
      const { motivo } = await readJson<{ motivo: string }>(request);
      conversacion.estado = "persona";
      conversacion.asignadaA = YO;
      conversacion.motivo = motivo || "Otro";
      agregar(conversacion, {
        tipo: "sistema",
        evento: "toma",
        texto: `${YO} tomó la conversación · motivo: ${(motivo || "otro").toLowerCase()} · el bot se apartó`,
      });
      return Response.json(conversacion);
    }),
  },
  {
    method: "POST",
    pattern: /^\/conversaciones\/([^/]+)\/devolver$/,
    handler: accion((conversacion) => {
      conversacion.estado = "bot";
      conversacion.asignadaA = null;
      agregar(conversacion, { tipo: "sistema", evento: "toma", texto: `${YO} devolvió la conversación al bot` });
      return Response.json(conversacion);
    }),
  },
  {
    method: "POST",
    pattern: /^\/conversaciones\/([^/]+)\/cerrar$/,
    handler: accion((conversacion) => {
      conversacion.estado = "cerrada";
      conversacion.sinLeer = 0;
      agregar(conversacion, { tipo: "sistema", evento: "cierre", texto: `${YO} cerró la conversación` });
      return Response.json(conversacion);
    }),
  },
  {
    method: "POST",
    pattern: /^\/conversaciones\/([^/]+)\/leer$/,
    handler: accion((conversacion) => {
      conversacion.sinLeer = 0;
      return Response.json({ ok: true });
    }),
  },
  {
    method: "POST",
    pattern: /^\/conversaciones\/([^/]+)\/mensajes$/,
    handler: accion(async (conversacion, request) => {
      const body = await readJson<NuevoMensaje>(request);
      const texto = body.texto?.trim() ?? "";

      if (body.tipo === "nota") {
        if (!texto) return errorResponse(422, "La nota está vacía.");
        agregar(conversacion, { tipo: "nota", autorNombre: YO, texto });
        return Response.json(conversacion);
      }

      if (body.tipo === "plantilla") {
        const plantilla = plantillas.find((item) => item.id === body.plantillaId);
        if (!plantilla) return errorResponse(422, "Elegí una plantilla aprobada.");
        const nombre = primerNombre(conversacion.clienta.nombre);
        agregar(conversacion, {
          tipo: "texto",
          autor: "persona",
          autorNombre: YO,
          plantilla: plantilla.nombre,
          texto: plantilla.texto.replaceAll("{{nombre}}", nombre),
        });
        return Response.json(conversacion);
      }

      if (!texto) return errorResponse(422, "El mensaje está vacío.");
      if (!conversacion.ventanaHasta || new Date(conversacion.ventanaHasta).getTime() < Date.now()) {
        return errorResponse(
          409,
          "Pasaron más de 24 h desde el último mensaje de la clienta: solo se pueden mandar plantillas aprobadas por Meta.",
        );
      }
      if (conversacion.estado !== "persona") {
        conversacion.estado = "persona";
        conversacion.asignadaA = YO;
        conversacion.motivo = conversacion.motivo ?? "Respondió una persona";
        agregar(conversacion, {
          tipo: "sistema",
          evento: "toma",
          texto: `${YO} tomó la conversación al responder · el bot se apartó`,
        });
      }
      conversacion.sinLeer = 0;
      agregar(conversacion, { tipo: "texto", autor: "persona", autorNombre: YO, texto });
      return Response.json(conversacion);
    }),
  },
];
