import { cn } from "@/lib/utils";

type MeterProps = {
  /** Valor entre 0 y `max`. */
  value: number;
  max?: number;
  /** Nombre accesible ("Avance al mínimo"). */
  label: string;
  /** Texto que leen los lectores de pantalla ("$ 23.300 de $ 45.000"). */
  valueText?: string;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
};

const toneClass = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

/** Barra de avance accesible (role="meter"): mínimo de compra, salud, tope de gasto… */
export function Meter({ value, max = 1, label, valueText, tone = "primary", className }: MeterProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-foreground/8", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-snappy", toneClass[tone])}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
