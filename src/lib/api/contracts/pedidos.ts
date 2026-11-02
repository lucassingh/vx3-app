import { toQueryString, type ApiRequest } from "../http";
import type {
  Banco,
  Canal,
  ClientaRef,
  EstadoPedido,
  MedioPago,
  OrigenVenta,
  Paginated,
  Transporte,
  Zona,
} from "../types";

/** M5 · Pedidos y facturación: bandeja única y facturar es revisar y confirmar. */

export type PedidoBandejaLinea = {
  /** Código del bulto en DUX (SKU-6, SKU-12). */
  codigo: string;
  nombre: string;
  presentacion: string;
  bultos: number;
  precioUnitario: number;
  subtotal: number;
};

export type PasoCicloPedido = {
  estado: EstadoPedido;
  /** Fecha y hora ISO en que pasó; null si todavía no. */
  at: string | null;
  hecho: boolean;
  actual: boolean;
};

export type PedidoBandeja = {
  id: string;
  clienta: ClientaRef & { localidad: string; cp: string; zona: Zona };
  canal: Canal;
  origen: OrigenVenta;
  /** Nombre del anuncio de origen, si vino de pauta. */
  anuncio?: string;
  /** "CJATN14-6 ×2 · VN16-6 ×1". */
  resumen: string;
  bultos: number;
  lineas: PedidoBandejaLinea[];
  mercaderia: number;
  envio: number;
  embalaje: number;
  total: number;
  pesoKg: number;
  faltaParaMinimo: number;
  transporte: Transporte;
  pago: MedioPago;
  banco?: Banco;
  estado: EstadoPedido;
  /** Fecha y hora ISO de creación. */
  creadoAt: string;
  factura?: string;
  nota?: string;
  /** Armándose hace más de 2 h, o bajo el mínimo después de los 30 minutos. */
  trabado: boolean;
  pasos: PasoCicloPedido[];
};

export type PedidosQuery = {
  q?: string;
  estado?: EstadoPedido;
  canal?: Canal;
  page?: number;
  pageSize?: number;
};

export type PedidosLista = Paginated<PedidoBandeja> & {
  /** Conteos por estado con los demás filtros aplicados (para las pestañas). */
  conteos: Partial<Record<EstadoPedido, number>>;
  totalSinEstado: number;
};

/** Secuencia de recuperación de un pedido trabado (RN-70 a RN-77). */
export type PedidoTrabado = {
  pedido: PedidoBandeja;
  motivo: "sin_respuesta" | "bajo_minimo";
  palanca?: string;
  ultimoMensaje: string;
  pasos: { id: string; label: string; estado: "hecho" | "proximo" | "pendiente"; at: string | null }[];
};

export type ChequeoFacturacion = {
  id: "comprobante" | "monto" | "destino" | "minimo" | "transporte" | "codigos";
  label: string;
  /** "aviso" no bloquea; "falla" sí; "na": no aplica (el comprobante en una contraentrega). */
  estado: "ok" | "aviso" | "falla" | "na";
  detalle: string;
};

export type PedidoFacturable = {
  pedido: PedidoBandeja;
  chequeos: ChequeoFacturacion[];
  listo: boolean;
  /** Campos que la app prellena según RN-23 a RN-27. */
  campos: {
    tipoComprobante: "Factura" | "Comprobante de venta";
    puntoVenta: string;
    lista: string;
    etiqueta: string;
    items: { codigo: string; descripcion: string; monto: number }[];
    cobranza: string;
  };
};

export type FacturaEmitida = {
  numero: string;
  pedidoId: string;
  clienta: string;
  total: number;
  /** Fecha y hora ISO. */
  emitidaAt: string;
  /** La validación ante ARCA es asíncrona (RF-M5-04). Los comprobantes de venta no van a ARCA. */
  arca: "pendiente" | "validado" | "cae" | "no_aplica";
  cae?: string;
  remito: "en_cola" | "impreso";
};

export function pedidosEndpoints(request: ApiRequest) {
  return {
    list: (query: PedidosQuery = {}) => request<PedidosLista>(`/pedidos${toQueryString(query)}`),
    trabados: () => request<PedidoTrabado[]>("/pedidos/trabados"),
    facturables: () => request<PedidoFacturable[]>("/pedidos/facturables"),
    facturas: () => request<FacturaEmitida[]>("/pedidos/facturas"),
    facturar: (ids: string[]) =>
      request<{ facturas: FacturaEmitida[] }>("/pedidos/facturar", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
  };
}
