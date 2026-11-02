import type { EstadoConversacion, EtapaConversacion, LineaWhatsapp } from "@/lib/api/types";
import type { BadgeTone } from "@/lib/domain";

export const ESTADO_CONVERSACION: Record<EstadoConversacion, { label: string; tone: BadgeTone }> = {
  bot: { label: "Bot", tone: "accent" },
  esperando: { label: "Esperando persona", tone: "warning" },
  persona: { label: "Con persona", tone: "primary" },
  cerrada: { label: "Cerrada", tone: "neutral" },
};

/** RF-M11-10. */
export const ETAPA_CONVERSACION: Record<EtapaConversacion, string> = {
  consulto: "Consultó",
  producto: "Producto identificado",
  pedido: "Armó pedido",
  cotizo: "Cotizó envío",
  cerro: "Cerró",
  se_cayo: "Se cayó",
};

export const LINEA: Record<LineaWhatsapp, string> = {
  ventas: "WhatsApp de ventas",
  local: "WhatsApp del local",
};

export type FiltroBandeja = "todas" | "sin_responder" | "derivadas" | "mias" | "con_pedido" | "con_reclamo";

export const FILTROS: { id: FiltroBandeja; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "sin_responder", label: "Sin responder" },
  { id: "derivadas", label: "Derivadas" },
  { id: "mias", label: "Mías" },
  { id: "con_pedido", label: "Con pedido abierto" },
  { id: "con_reclamo", label: "Con reclamo" },
];
