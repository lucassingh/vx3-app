import { cn } from "@/lib/utils";

export type BarListItem = {
  id: string;
  label: React.ReactNode;
  value: number;
  /** Valor ya formateado ("$ 412.000", "18 pedidos"). */
  valueLabel: string;
  /** Texto secundario a la derecha del valor ("34 %"). */
  detail?: string;
  /** Color de la barra; por defecto el primario. */
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
};

const toneClass = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-muted-foreground/50",
} as const;

/** Lista de barras horizontales con etiqueta y valor. La barra más larga es el máximo. */
export function BarList({ items, className }: { items: BarListItem[]; className?: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {items.map((item) => (
        <li key={item.id} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">{item.valueLabel}</span>
              {item.detail && ` · ${item.detail}`}
            </span>
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-primary/12">
            <div
              className={cn("h-full rounded-full", toneClass[item.tone ?? "primary"])}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
