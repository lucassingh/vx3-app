import type { CatalogoVigencia } from "@/lib/api/types";
import type { BadgeTone } from "@/lib/domain";

export const VIGENCIA: Record<CatalogoVigencia, { label: string; plural: string; tone: BadgeTone }> = {
  activo: { label: "Activo", plural: "Activos", tone: "success" },
  agotado: { label: "Agotado", plural: "Agotados", tone: "warning" },
  historico: { label: "Histórico", plural: "Históricos", tone: "neutral" },
};
