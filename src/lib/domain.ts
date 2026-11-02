import {
  Globe,
  MessageCircle,
  Store,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type {
  Banco,
  Canal,
  EstadoPedido,
  MedioPago,
  OrigenVenta,
  Segmento,
  Transporte,
  Zona,
} from "@/lib/api/types";

/**
 * Etiquetas y variantes de badge de los valores de negocio compartidos.
 * Todas las pantallas usan estos mapas: un "Facturado" se ve igual en todos lados.
 */

export type BadgeTone = "neutral" | "outline" | "primary" | "accent" | "success" | "warning" | "danger";

type Labeled = { label: string; tone: BadgeTone };

export const ESTADO_PEDIDO: Record<EstadoPedido, Labeled> = {
  armandose: { label: "Armándose", tone: "neutral" },
  pendiente_pago: { label: "Pendiente de pago", tone: "warning" },
  listo_facturar: { label: "Listo para facturar", tone: "primary" },
  facturado: { label: "Facturado", tone: "primary" },
  en_armado: { label: "En armado", tone: "accent" },
  despachado: { label: "Despachado", tone: "accent" },
  entregado: { label: "Entregado", tone: "success" },
  cobrado: { label: "Cobrado", tone: "success" },
  rendido: { label: "Rendido", tone: "success" },
  devuelto: { label: "Devuelto", tone: "danger" },
  anulado: { label: "Anulado", tone: "neutral" },
};

/** Orden del ciclo de vida, para líneas de tiempo y filtros. */
export const ESTADOS_PEDIDO_ORDEN: EstadoPedido[] = [
  "armandose",
  "pendiente_pago",
  "listo_facturar",
  "facturado",
  "en_armado",
  "despachado",
  "entregado",
  "cobrado",
  "rendido",
];

export const CANAL: Record<Canal, { label: string; icon: LucideIcon }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  vidriera: { label: "Vidriera", icon: Globe },
  local: { label: "Local", icon: Store },
  tiendanube: { label: "Tienda Nube", icon: ShoppingBag },
};

export const ORIGEN_VENTA: Record<OrigenVenta, Labeled> = {
  anuncio: { label: "Anuncio", tone: "accent" },
  recompra: { label: "Recompra", tone: "success" },
  organico: { label: "Orgánico", tone: "neutral" },
};

export const ZONA: Record<Zona, { label: string; short: string }> = {
  amba_1: { label: "AMBA · zona 1", short: "Zona 1" },
  amba_2: { label: "AMBA · zona 2", short: "Zona 2" },
  interior: { label: "Interior", short: "Interior" },
};

export const TRANSPORTE: Record<Transporte, string> = {
  mensajeria: "Mensajería (Transtech)",
  correo: "Correo Argentino",
  via_cargo: "Vía Cargo",
  retira: "Retira en el local",
};

export const MEDIO_PAGO: Record<MedioPago, string> = {
  transferencia: "Transferencia",
  contraentrega: "Contraentrega",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta / QR",
};

export const BANCO: Record<Banco, string> = {
  santander: "Santander",
  supervielle: "Supervielle",
  provincia: "Provincia",
  nacion: "Nación",
};

export const SEGMENTO: Record<Segmento, Labeled & { description: string }> = {
  nueva: { label: "Nueva", tone: "accent", description: "Una sola compra, en los últimos 30 días" },
  activa: { label: "Activa", tone: "success", description: "Compra dentro de su ciclo" },
  top: { label: "Top", tone: "primary", description: "Las que más margen dejan" },
  en_riesgo: { label: "En riesgo", tone: "warning", description: "Se pasó de su ciclo de compra" },
  dormida: { label: "Dormida", tone: "neutral", description: "Más de 60 días sin comprar" },
};
