import type { ApiRequest } from "../http";
import type { ClientaRef, Kpi } from "../types";

/** M8 · Post-venta: reclamo, evidencia, resolución, nota de crédito y causa en un registro. */

/** RN-54 a RN-59. */
export type TipoReclamo = 1 | 2 | 3 | 4 | 5 | 6;

/** RN-62: el origen nunca queda vacío. */
export type OrigenReclamo = "armado" | "proveedor" | "envio" | "catalogo" | "bot" | "sin_determinar";

export type ReclamoPostventa = {
  id: string;
  pedidoId: string;
  clienta: ClientaRef;
  tipo: TipoReclamo;
  sku: string;
  producto: string;
  /** Lo que contó la clienta. */
  relato: string;
  estado: "abierto" | "esperando_evidencia" | "resuelto";
  /** Fechas y horas ISO. */
  creadoAt: string;
  venceAt: string;
  /** Horas que faltan para el SLA de 24 h (negativo si venció). */
  horasRestantes: number;
  evidencia: {
    requiereVideo: boolean;
    /** Por qué no hace falta el video (RN-52), si aplica. */
    excepcion?: string;
    recibida: string[];
    falta: string[];
  };
  compraPedido: number;
  compra30d: number;
  resolucion: { sugerida: string; monto: number; calculo: string };
  notaCredito: { necesaria: boolean; cargada: boolean; detalle: string };
  origen: OrigenReclamo | null;
  origenSugerido: OrigenReclamo;
  responsable: string;
};

export type PostventaResumen = {
  kpis: Kpi[];
  reclamos: ReclamoPostventa[];
  causas: {
    origenes: { id: OrigenReclamo; label: string }[];
    filas: { tipo: TipoReclamo; label: string; porOrigen: Partial<Record<OrigenReclamo, number>> }[];
  };
  tendenciaTipo1: { semana: string; cantidad: number }[];
  escalar: { activo: boolean; mensaje: string };
};

export function postventaEndpoints(request: ApiRequest) {
  return {
    resumen: () => request<PostventaResumen>("/postventa"),
    resolver: (id: string, origen: OrigenReclamo) =>
      request<{ ok: true }>(`/postventa/${encodeURIComponent(id)}/resolver`, {
        method: "POST",
        body: JSON.stringify({ origen }),
      }),
  };
}
