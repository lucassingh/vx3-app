import type { ApiRequest } from "../http";
import type { ClientaRef, Kpi, MedioPago, Share, Transporte, Zona } from "../types";

/** M3 · Bot comercial (WhatsApp + Claude): rendimiento y configuración por los socios. */

/** Recorridos que tiene que resolver el bot (05 §4.2). */
export type RecorridoBot = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type EtapaPuestaEnMarcha = "sombra" | "parcial" | "completo";

export type BotRendimiento = {
  kpis: Kpi[];
  puestaEnMarcha: {
    etapa: EtapaPuestaEnMarcha;
    /** Acierto sobre el set de evaluación con conversaciones reales (fracción). */
    acierto: number;
    /** Acierto que hay que superar para pasar a la etapa siguiente. */
    umbral: number;
    conversacionesEvaluadas: number;
    correccionesEnSombra: number;
    diasEnSombra: number;
    horario: string;
  };
  derivaciones: Share[];
  recorridos: {
    id: RecorridoBot;
    nombre: string;
    descripcion: string;
    conversaciones: number;
    /** null si todavía no está habilitado. */
    acierto: number | null;
    habilitado: boolean;
  }[];
  /** Backlog pedido a Byos (B-1 a B-9): criterio de aceptación del bot nuevo (RF-M3-15). */
  backlog: { id: string; criterio: string; estado: "cumple" | "en_prueba" | "pendiente"; evidencia: string }[];
};

export type HerramientaBot =
  | "buscar_producto"
  | "ver_producto"
  | "ver_stock"
  | "cotizar_envio"
  | "armar_pedido"
  | "estado_pedido"
  | "crear_reclamo"
  | "derivar";

export type RespuestaBot = {
  id: string;
  clienta: ClientaRef;
  conversacionId: string;
  recorrido: RecorridoBot;
  mensajeClienta: string;
  respuesta: string;
  herramientas: { nombre: HerramientaBot; detalle: string }[];
  derivo: boolean;
  motivoDerivacion?: string;
  /** Fecha y hora ISO. */
  respondidaEn: string;
  calificacion: "buena" | "mala" | null;
  costoUsd: number;
};

export type MatrizEnvioPago = { transporte: Transporte; zona: Zona; pagos: MedioPago[] }[];

export type BotConfig = {
  /** Hora del servidor, para mostrar hace cuánto se publicó cada versión. */
  generadoEn: string;
  versiones: {
    publicada: { numero: number; publicadaEn: string; por: string; acierto: number };
    borrador: { numero: number; editadoEn: string; por: string; cambios: string[] } | null;
    historial: { numero: number; fecha: string; por: string; resumen: string; acierto: number }[];
  };
  identidad: {
    nombre: string;
    trato: "vos" | "usted";
    emojis: "nunca" | "pocos" | "libres";
    guia: string;
    suena: string[];
    noSuena: string[];
  };
  reglas: {
    pedidoMinimo: number;
    senaRetiro: number;
    corteDespachoAmba: string;
    horarioDesde: string;
    horarioHasta: string;
    diasAtencion: string;
    mediosPago: { id: MedioPago; activo: boolean }[];
    matriz: MatrizEnvioPago;
  };
  preguntas: { id: string; pregunta: string; respuesta: string }[];
  palancas: { id: string; nombre: string; condicion: string; ejemplo: string; activa: boolean }[];
  secuencia: { paso: string; cuando: string; accion: string }[];
  derivacion: { id: string; cuando: string; a: string; activa: boolean }[];
  limites: string[];
};

export type BotRespuestas = { generadoEn: string; respuestas: RespuestaBot[] };

export type BotPrueba = {
  respuesta: string;
  herramientas: { nombre: HerramientaBot; detalle: string }[];
  derivaria: boolean;
};

export type BotPublicacion = { numero: number; acierto: number; casos: number; aprobados: number };

export function botEndpoints(request: ApiRequest) {
  const json = (method: string, body?: object): RequestInit => ({
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    rendimiento: () => request<BotRendimiento>("/bot/rendimiento"),
    respuestas: () => request<BotRespuestas>("/bot/respuestas"),
    calificar: (id: string, calificacion: "buena" | "mala") =>
      request<RespuestaBot>(`/bot/respuestas/${encodeURIComponent(id)}/calificar`, json("POST", { calificacion })),
    config: () => request<BotConfig>("/bot/config"),
    guardarBorrador: (config: Omit<BotConfig, "versiones" | "generadoEn">) =>
      request<BotConfig>("/bot/config", json("PUT", config)),
    publicar: () => request<BotPublicacion>("/bot/config/publicar", json("POST")),
    probar: (mensaje: string) => request<BotPrueba>("/bot/probar", json("POST", { mensaje })),
  };
}
