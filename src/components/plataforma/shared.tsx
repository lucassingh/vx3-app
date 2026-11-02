import type { RolUsuario } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Piezas compartidas por las pantallas de Configuración, Ajustes y Perfil. */

/**
 * "recién", "hace 5 minutos", "ayer". Solo en Server Components que ya
 * pidieron datos a la API (son dinámicos, así que pueden usar la hora).
 */
export function cuando(iso: string) {
  return Date.now() - new Date(iso).getTime() < 60_000 ? "recién" : formatRelativeTime(iso);
}

export const ROL: Record<RolUsuario, string> = {
  admin: "Administración",
  operaciones: "Operaciones",
  postventa: "Post-venta",
  compras: "Compras",
  marketing: "Marketing",
  solo_lectura: "Solo lectura",
};

/** ID del catálogo de reglas o del requerimiento ("RN-11"), en mono chico. */
export function CodeTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10.5px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Indicador con el mismo diseño que KpiCard, para valores que KpiGrid no formatea (US$ 0,0041). */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-3 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
