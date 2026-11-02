import type { StockEstado, StockProveedor } from "@/lib/api/types";
import type { BadgeTone } from "@/lib/domain";

export const ESTADO_STOCK: Record<StockEstado, { label: string; tone: BadgeTone }> = {
  agotado: { label: "Agotado", tone: "danger" },
  critico: { label: "Crítico", tone: "warning" },
  ok: { label: "Al día", tone: "success" },
  sobrestock: { label: "Sobrestock", tone: "accent" },
  sin_rotacion: { label: "Sin ventas", tone: "neutral" },
};

/** RN-36: al importado no se le reclama la mercadería fallada; al fabricante sí. */
export const TIPO_PROVEEDOR: Record<StockProveedor["tipo"], { label: string; tone: BadgeTone; reclamo: string }> = {
  fabricante: { label: "Fabricante", tone: "primary", reclamo: "Se le reclama la mercadería fallada" },
  mayorista: { label: "Mayorista", tone: "accent", reclamo: "Se le reclama la mercadería fallada" },
  importador: { label: "Importador", tone: "neutral", reclamo: "La mercadería fallada no se reclama" },
};
