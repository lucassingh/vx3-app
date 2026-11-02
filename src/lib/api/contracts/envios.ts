import type { ApiRequest } from "../http";
import type { ClientaRef, MedioPago, Transporte, Zona } from "../types";

/** M6 · Envíos: la misma cotización en el chat, en la factura y en la etiqueta. */

export type EnvioDelDia = {
  pedidoId: string;
  clienta: ClientaRef;
  localidad: string;
  provincia: string;
  cp: string;
  zona: Zona;
  /** Validación del CP contra la localidad (RF-M6-02, RN-86). */
  cpValido: boolean;
  cpDetalle: string;
  /** Cajas que salen (bultos de envío). */
  cajas: number;
  /** Bultos de mercadería del pedido. */
  bultos: number;
  pesoKg: number;
  pago: MedioPago;
  /** Monto a cobrar en la entrega, si es contraentrega. */
  aCobrar?: number;
  estado: "esperando_pago" | "por_facturar" | "en_armado" | "subido" | "despachado";
  etiqueta: string | null;
  /** Página de seguimiento que el bot le manda a la clienta (RF-M6-11). */
  seguimiento: string;
};

export type GrupoDespacho = {
  transporte: Transporte;
  label: string;
  /** Corte del día (RN-80): "12:00", "17:30", "18:30"; null si no tiene. */
  corte: string | null;
  corteDetalle: string;
  corteEstado: "a_tiempo" | "proximo" | "cerrado" | "sin_corte";
  accion: { id: "zupply" | "micorreo" | "etiquetas" | "aviso"; label: string; hecho: boolean };
  envios: EnvioDelDia[];
};

export type DesvioEnvio = {
  pedidoId: string;
  clienta: string;
  transporte: Transporte;
  cotizado: number;
  cobrado: number;
  /** (cobrado − cotizado) ÷ cotizado. */
  desvio: number;
  alerta: boolean;
  motivo: string;
};

export type DesviosEnvio = { umbral: number; casos: DesvioEnvio[] };

export type CotizadorOpciones = {
  productos: { sku: string; label: string; detalle: string }[];
  destinos: { cp: string; localidad: string; zona: string }[];
};

export type CotizarInput = {
  cp: string;
  localidad?: string;
  items: { sku: string; bultos: number }[];
  modoCorreo: "domicilio" | "sucursal";
  /** Para mostrar la cotización de respaldo (RF-M6-09). */
  simularFalla: boolean;
};

export type CajaEnvio = {
  id: string;
  caja: string;
  medidas: string;
  pesoKg: number;
  contenido: string;
};

export type OpcionEnvio = {
  id: Transporte;
  label: string;
  /** null: lo paga la clienta en destino. */
  precio: number | null;
  embalaje: number;
  disponible: boolean;
  estimada: boolean;
  detalle: string;
  /** Precio de cada caja en el Correo. */
  porCaja?: number[];
  recomendada?: boolean;
};

export type CotizacionEnvio = {
  id: string;
  /** Fecha y hora ISO de vencimiento. */
  venceAt: string;
  vigenciaHoras: number;
  destino: { cp: string; localidad: string; provincia: string; zona: Zona | null; valido: boolean; detalle: string };
  cajas: CajaEnvio[];
  pesoTotalKg: number;
  mercaderia: number;
  faltaParaMinimo: number;
  fuente: "micorreo" | "respaldo";
  aviso?: string;
  opciones: OpcionEnvio[];
};

export function enviosEndpoints(request: ApiRequest) {
  return {
    despacho: () => request<GrupoDespacho[]>("/envios/despacho"),
    accionDespacho: (transporte: Transporte) =>
      request<{ ok: true; mensaje: string }>(`/envios/despacho/${transporte}`, { method: "POST" }),
    desvios: () => request<DesviosEnvio>("/envios/desvios"),
    opcionesCotizador: () => request<CotizadorOpciones>("/envios/cotizador"),
    cotizar: (input: CotizarInput) =>
      request<CotizacionEnvio>("/envios/cotizar", { method: "POST", body: JSON.stringify(input) }),
    guardarCotizacion: (id: string) =>
      request<{ ok: true; id: string }>(`/envios/cotizaciones/${encodeURIComponent(id)}`, {
        method: "POST",
      }),
  };
}
