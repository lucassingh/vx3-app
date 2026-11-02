import type {
  Banco,
  Canal,
  EstadoPedido,
  MedioPago,
  OrigenVenta,
  Transporte,
  Zona,
} from "@/lib/api/types";
import { getClienta } from "./clientas";
import { getProducto, presentacionesDe } from "./productos";
import { DAY, HOUR } from "./time";

/**
 * Pedidos recientes (los últimos ~10 días). Cada uno une clienta, canal,
 * anuncio de origen, envío, cobro y factura: es la identidad única de pedido
 * (DOL-20). Los montos se calculan con el motor de precios y las reglas de
 * envío y embalaje (RN-26).
 */

export type PedidoSeed = {
  id: string;
  clientaId: string;
  canal: Canal;
  origen: OrigenVenta;
  anuncioId?: string;
  /** Cantidades en bultos (RN-29c). */
  items: { sku: string; bultos: number }[];
  transporte: Transporte;
  pago: MedioPago;
  banco?: Banco;
  estado: EstadoPedido;
  creadoHaceMin: number;
  factura?: string;
  /** Lo que la app marca para que alguien lo mire. */
  nota?: string;
};

const p = (
  id: string,
  clientaId: string,
  canal: Canal,
  origen: OrigenVenta,
  anuncioId: string | undefined,
  items: [string, number][],
  transporte: Transporte,
  pago: MedioPago,
  banco: Banco | undefined,
  estado: EstadoPedido,
  creadoHaceMin: number,
  factura?: string,
  nota?: string,
): PedidoSeed => ({
  id, clientaId, canal, origen, anuncioId,
  items: items.map(([sku, bultos]) => ({ sku, bultos })),
  transporte, pago, banco, estado, creadoHaceMin, factura, nota,
});

export const pedidos: PedidoSeed[] = [
  // Hoy
  p("V-1059", "c-05", "whatsapp", "anuncio", "a-02", [["CAN9", 1], ["VN25", 2]], "correo", "transferencia", undefined, "armandose", 25),
  p("V-1058", "c-09", "vidriera", "anuncio", "a-04", [["CJATN31", 1], ["LN35", 2]], "mensajeria", "contraentrega", undefined, "listo_facturar", 40),
  p("V-1057", "c-02", "whatsapp", "recompra", undefined, [["MLN10", 2], ["MSN1", 1], ["LN35", 2]], "mensajeria", "contraentrega", undefined, "listo_facturar", 55),
  p("V-1056", "c-14", "whatsapp", "anuncio", "a-02", [["CAN9", 1], ["CJALN1", 1]], "correo", "transferencia", "santander", "pendiente_pago", 80, undefined, "Comprobante recibido: falta confirmar el monto en el banco."),
  p("V-1055", "c-01", "whatsapp", "recompra", undefined, [["CJATN14", 2], ["VN16", 1], ["LN35", 2]], "mensajeria", "transferencia", "supervielle", "listo_facturar", 95),
  p("V-1054", "c-21", "whatsapp", "anuncio", "a-03", [["VN16", 3], ["VN31", 2], ["LG18", 1]], "correo", "transferencia", undefined, "pendiente_pago", 130),
  p("V-1053", "c-13", "local", "recompra", undefined, [["BMN1", 2], ["HB2", 2], ["UG9", 1], ["CAN9", 1]], "retira", "efectivo", undefined, "facturado", 150, "CV 0002-00031877"),
  p("V-1052", "c-11", "whatsapp", "anuncio", "a-06", [["LN35", 4], ["LN66", 2], ["VN14", 2]], "mensajeria", "contraentrega", undefined, "facturado", 170, "CV 0002-00031876"),
  p("V-1051", "c-24", "tiendanube", "organico", undefined, [["CJATN2", 1], ["BCN2", 1]], "correo", "tarjeta", undefined, "facturado", 200, "FC-B 0002-00018431"),
  p("V-1050", "c-19", "whatsapp", "anuncio", "a-04", [["CJATN31", 1], ["CAN12", 1]], "mensajeria", "contraentrega", undefined, "en_armado", 230, "CV 0002-00031874"),
  p("V-1049", "c-15", "vidriera", "organico", undefined, [["CDTLN6", 1], ["BMN1", 2]], "mensajeria", "transferencia", "provincia", "en_armado", 260, "FC-B 0002-00018430"),
  p("V-1048", "c-03", "whatsapp", "recompra", undefined, [["VN16", 2], ["LG18", 1], ["CAN9", 1]], "via_cargo", "transferencia", "santander", "despachado", 300, "FC-B 0002-00018429"),
  p("V-1047", "c-07", "whatsapp", "anuncio", "a-01", [["CJATN14", 1], ["LN35", 4]], "mensajeria", "contraentrega", undefined, "armandose", 200, undefined, "Sin respuesta hace 3 h: el bot ya mandó el segundo mensaje."),
  p("V-1046", "c-17", "whatsapp", "recompra", undefined, [["MLN10", 3], ["MTNH4", 1]], "mensajeria", "contraentrega", undefined, "armandose", 340, undefined, "Bajo el mínimo: el bot le pidió un complementario por la diferencia."),
  // Ayer y antes
  p("V-1045", "c-04", "whatsapp", "recompra", undefined, [["CJATN14", 2], ["CJATN31", 1], ["CAN9", 2]], "mensajeria", "transferencia", "supervielle", "entregado", DAY + 2 * HOUR, "FC-B 0002-00018422"),
  p("V-1044", "c-15", "whatsapp", "recompra", undefined, [["VN14", 2], ["BMN1", 2], ["HB3", 2]], "mensajeria", "contraentrega", undefined, "despachado", DAY + 4 * HOUR, "CV 0002-00031861"),
  p("V-1043", "c-01", "vidriera", "recompra", undefined, [["CJATN14", 1], ["LN35", 4]], "mensajeria", "transferencia", "santander", "entregado", 2 * DAY, "FC-B 0002-00018417"),
  p("V-1042", "c-11", "whatsapp", "anuncio", "a-06", [["CAN9", 1], ["VN16", 1], ["LN35", 3]], "mensajeria", "contraentrega", undefined, "entregado", 3 * DAY, "CV 0002-00031840", "Entregado según Zupply hace 2 días y sin rendir."),
  p("V-1041", "c-11", "whatsapp", "recompra", undefined, [["CJACN1", 1], ["UG9", 2]], "mensajeria", "contraentrega", undefined, "cobrado", 4 * DAY, "CV 0002-00031822", "Transtech cobró en efectivo: falta la rendición."),
  p("V-1040", "c-23", "whatsapp", "anuncio", "a-06", [["LN35", 4], ["VN25", 4], ["VN14", 1]], "mensajeria", "contraentrega", undefined, "devuelto", 5 * DAY, "CV 0002-00031809", "Rebote por fecha mal programada: el paquete volvió al local."),
  p("V-1039", "c-08", "tiendanube", "organico", undefined, [["CJATN31", 1], ["BCN2", 1]], "correo", "tarjeta", undefined, "entregado", 5 * DAY + 3 * HOUR, "FC-B 0002-00018390"),
  p("V-1038", "c-18", "whatsapp", "anuncio", "a-03", [["VN16", 2], ["LN66", 1], ["CAN9", 1]], "correo", "transferencia", "provincia", "entregado", 6 * DAY, "FC-B 0002-00018377"),
  p("V-1037", "c-18", "whatsapp", "recompra", undefined, [["VN31", 3], ["UG9", 2], ["BMN1", 2]], "correo", "transferencia", "santander", "entregado", 7 * DAY, "FC-B 0002-00018361"),
  p("V-1036", "c-19", "whatsapp", "anuncio", "a-04", [["CJATN31", 1], ["LN35", 2]], "mensajeria", "contraentrega", undefined, "rendido", 8 * DAY, "CV 0002-00031771"),
  p("V-1035", "c-15", "whatsapp", "organico", undefined, [["CAN9", 1], ["BMN1", 2], ["VN14", 2]], "mensajeria", "contraentrega", undefined, "rendido", 8 * DAY + 5 * HOUR, "CV 0002-00031768"),
  p("V-1034", "c-13", "local", "recompra", undefined, [["HB2", 2], ["MTNH4", 2], ["MSN1", 2]], "retira", "efectivo", undefined, "entregado", 9 * DAY, "CV 0002-00031752"),
  p("V-1033", "c-04", "whatsapp", "recompra", undefined, [["CJATN2", 1], ["CAN9", 1], ["VN16", 1]], "mensajeria", "contraentrega", undefined, "cobrado", 9 * DAY + 6 * HOUR, "CV 0002-00031749"),
  p("V-1032", "c-20", "whatsapp", "organico", undefined, [["PVM3", 1]], "mensajeria", "contraentrega", undefined, "anulado", 10 * DAY, undefined, "Anulado a las 24 h: no respondió para confirmar (RN-73)."),
];

/* ---- Montos (RN-20, RN-26) ------------------------------------------------ */

/** Pedido mínimo sin envío (RN-20). */
export const PEDIDO_MINIMO = 45_000;

/** Valores de ejemplo: la tabla real de zonas y tarifas está pendiente (Q-40). */
export const TARIFAS = {
  envio1: 4_500,
  envio2: 6_500,
  embalaje1: 1_200,
  embalaje2: 2_000,
} as const;

const ceil100 = (value: number) => Math.ceil(value / 100) * 100;

/** Cotización de Correo de ejemplo por peso total del pedido. */
export function cotizarCorreo(pesoKg: number) {
  return ceil100(7_900 + pesoKg * 1_300);
}

function envioDe(transporte: Transporte, zona: Zona, pesoKg: number) {
  switch (transporte) {
    case "mensajeria":
      return {
        envio: zona === "amba_1" ? TARIFAS.envio1 : TARIFAS.envio2,
        embalaje: TARIFAS.embalaje1,
      };
    case "correo":
      return { envio: cotizarCorreo(pesoKg), embalaje: TARIFAS.embalaje2 };
    case "via_cargo":
      // La clienta paga el flete al retirar (RN-83).
      return { envio: 0, embalaje: TARIFAS.embalaje2 };
    case "retira":
      return { envio: 0, embalaje: 0 };
  }
}

/** Renglones, totales y margen de un pedido (margen sobre la mercadería). */
export function detalleDe(pedido: PedidoSeed) {
  const clienta = getClienta(pedido.clientaId);
  const lineas = pedido.items.map(({ sku, bultos }) => {
    const producto = getProducto(sku);
    const { bulto } = presentacionesDe(producto);
    return {
      sku,
      codigo: bulto.codigo,
      nombre: producto.nombre,
      presentacion: bulto.label,
      bultos,
      precioUnitario: bulto.precio,
      subtotal: bulto.precio * bultos,
      costo: bulto.costo * bultos,
      pesoKg: producto.pesoBultoKg * bultos,
    };
  });

  const mercaderia = lineas.reduce((sum, linea) => sum + linea.subtotal, 0);
  const costo = lineas.reduce((sum, linea) => sum + linea.costo, 0);
  const pesoKg = lineas.reduce((sum, linea) => sum + linea.pesoKg, 0);
  const { envio, embalaje } = envioDe(pedido.transporte, clienta.zona, pesoKg);

  return {
    lineas,
    mercaderia,
    envio,
    embalaje,
    total: mercaderia + envio + embalaje,
    margen: Math.round(mercaderia - costo),
    pesoKg: Math.round(pesoKg * 100) / 100,
    /** Lo que falta para el mínimo; 0 si ya llega (RN-77). */
    faltaParaMinimo: Math.max(0, PEDIDO_MINIMO - mercaderia),
  };
}

const byId = new Map(pedidos.map((pedido) => [pedido.id, pedido]));

export function getPedido(id: string) {
  const pedido = byId.get(id);
  if (!pedido) throw new Error(`No existe el pedido ${id} en la semilla.`);
  return pedido;
}

/**
 * Contraentrega pendiente con Transtech al último corte (dato real del 23/10).
 * La pantalla de Contraentrega y el Inicio usan estos totales.
 */
export const contraentregaPendiente = {
  total: 1_002_000,
  entregadosSinRendir: { casos: 8, monto: 486_000 },
  enCamino: { casos: 6, monto: 352_000 },
  ausentes: { casos: 3, monto: 164_000 },
} as const;
