import { toQueryString, type ApiRequest } from "../http";
import type { DailyPoint, Kpi } from "../types";

/** M9 · Pauta en Meta: gasto, ventas verificadas y margen real por anuncio (RM). */

export type PeriodoPauta = 7 | 14;

export type SemaforoAnuncio = "escalar" | "mantener" | "revisar" | "apagar";

export type AnuncioFila = {
  id: string;
  nombre: string;
  campana: string;
  conjunto: string;
  sku: string | null;
  producto: { nombre: string; colores: string[] } | null;
  zona: string;
  formato: string;
  estado: "activo" | "pausado";
  gastoUsd: number;
  gastoArs: number;
  conversaciones: number;
  pedidos: number;
  /** Pedidos ÷ conversaciones, como fracción. */
  tasaCierre: number | null;
  ventas: number;
  margen: number;
  /** Margen ÷ gasto en pesos (RN-92). null si no hubo gasto. */
  rm: number | null;
  /** Margen − gasto en pesos. */
  ganancia: number;
  /** Margen de las recompras posteriores de las clientas que trajo (RF-M9-09). */
  valorRecompra90d: number;
  semaforo: SemaforoAnuncio;
  motivo: string;
  /** Menos de 3 pedidos: no alcanza para decidir (RN-111). */
  muestraChica: boolean;
  /** Sin gasto en el período (RN-110). */
  legado: boolean;
};

export type AtribucionEstado = {
  periodo: PeriodoPauta;
  pedidosVerificados: number;
  /** Lo que la atribución le asigna a la pauta. */
  atribuido: number;
  /** Lo facturado en DUX para esos mismos pedidos. */
  facturado: number;
  pedidosLegado: number;
  /** Lo que decía Byos para la misma semana, para comparar. */
  pedidosSegunByos: number;
};

export type PautaConfig = {
  tipoCambio: {
    valor: number;
    actualizadoPor: string;
    /** Fecha y hora ISO. */
    actualizadoEl: string;
    historial: { valor: number; por: string; el: string }[];
  };
  conversiones: {
    estado: "activo" | "pendiente";
    permiso: string;
    eventos7d: number;
    deduplicados7d: number;
    /** Fecha y hora ISO. */
    ultimoEnvio: string;
  };
};

export type CampanaPresupuesto = {
  id: string;
  nombre: string;
  objetivo: string;
  anuncios: number;
  presupuestoUsd: number;
  gastadoUsd: number;
  proyeccionUsd: number;
  /** (proyección − presupuesto) ÷ presupuesto, como fracción. */
  desvio: number;
  rm: number | null;
  pedidos7d: number;
};

export type PresupuestoMes = {
  /** "octubre de 2026". */
  mes: string;
  dia: number;
  diasDelMes: number;
  tipoCambio: number;
  campanas: CampanaPresupuesto[];
  gastoDiario: DailyPoint[];
};

export type PausarResultado = {
  estado: "activo" | "pausado";
  /** Cambios que le quedan a ese conjunto en la hora (Meta permite 4). */
  cambiosRestantes: number;
};

export function pautaEndpoints(request: ApiRequest) {
  return {
    kpis: (dias: PeriodoPauta = 7) => request<Kpi[]>(`/pauta/kpis${toQueryString({ dias })}`),
    anuncios: (dias: PeriodoPauta = 7) =>
      request<AnuncioFila[]>(`/pauta/anuncios${toQueryString({ dias })}`),
    atribucion: (dias: PeriodoPauta = 7) =>
      request<AtribucionEstado>(`/pauta/atribucion${toQueryString({ dias })}`),
    config: () => request<PautaConfig>("/pauta/config"),
    cambiosDisponibles: (id: string) =>
      request<{ conjunto: string; cambiosRestantes: number }>(
        `/pauta/anuncios/${encodeURIComponent(id)}/cambios`,
      ),
    pausar: (id: string, pausar: boolean) =>
      request<PausarResultado>(`/pauta/anuncios/${encodeURIComponent(id)}/estado`, {
        method: "POST",
        body: JSON.stringify({ estado: pausar ? "pausado" : "activo" }),
      }),
    actualizarTipoCambio: (valor: number) =>
      request<PautaConfig["tipoCambio"]>("/pauta/tipo-cambio", {
        method: "PATCH",
        body: JSON.stringify({ valor }),
      }),
    presupuesto: () => request<PresupuestoMes>("/pauta/presupuesto"),
    actualizarPresupuesto: (id: string, presupuestoUsd: number) =>
      request<CampanaPresupuesto>(`/pauta/campanas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ presupuestoUsd }),
      }),
  };
}
