import { toQueryString, type ApiRequest } from "../http";
import type { DailyPoint, EstadoPedido, Kpi, MetricFormat, Segmento, Share } from "../types";

/**
 * M10 · Dashboard ejecutivo: la pantalla de inicio de los socios. Muestra los
 * indicadores que Elías revisa los lunes (Manual v4, P-15): los de resultado
 * (`kpis`) y los de causa (`causas`).
 */

/** Indicador de causa: lo que explica los números de la semana y dónde se resuelve. */
export type IndicadorCausa = {
  id: string;
  label: string;
  value: number;
  format: MetricFormat;
  detalle: string;
  estado: "ok" | "atencion" | "alerta";
  href: string;
  accion: string;
};

export type EmbudoPaso = { id: string; label: string; value: number };

export type CorteHorario = {
  id: string;
  label: string;
  /** "12:00", "17:30"… (RN-80). */
  hora: string;
  pendientes: number;
  estado: "a_tiempo" | "proximo" | "cerrado";
};

export type OperacionHoy = {
  porEstado: { estado: EstadoPedido; cantidad: number }[];
  trabados: number;
  listosParaFacturar: number;
  cortes: CorteHorario[];
};

export type AnuncioTop = {
  id: string;
  nombre: string;
  sku: string | null;
  gastoUsd: number;
  pedidos: number;
  margen: number;
  rm: number | null;
  semaforo: "escalar" | "mantener" | "revisar" | "apagar";
};

export type ClientaParaReactivar = {
  id: string;
  nombre: string;
  telefono: string;
  segmento: Segmento;
  ultimaCompraDias: number;
  totalComprado: number;
  motivo: string;
};

export function dashboardEndpoints(request: ApiRequest) {
  return {
    kpis: () => request<Kpi[]>("/dashboard/kpis"),
    causas: () => request<IndicadorCausa[]>("/dashboard/causas"),
    ventas: (days = 30) => request<DailyPoint[]>(`/dashboard/ventas${toQueryString({ days })}`),
    canales: () => request<Share[]>("/dashboard/canales"),
    embudo: () => request<EmbudoPaso[]>("/dashboard/embudo"),
    operacion: () => request<OperacionHoy>("/dashboard/operacion"),
    topAnuncios: () => request<AnuncioTop[]>("/dashboard/top-anuncios"),
    reactivar: () => request<ClientaParaReactivar[]>("/dashboard/reactivar"),
  };
}
