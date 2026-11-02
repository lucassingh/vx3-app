import { Gauge, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { StatGridSkeleton } from "@/components/views/skeletons";
import type { Kpi } from "@/lib/api/types";
import { formatDelta, formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";

const columnsClass = {
  3: "grid gap-4 sm:grid-cols-3",
  4: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
  5: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5",
} as const;

type KpiGridProps = {
  items: Kpi[];
  /** Ícono por id de indicador; los que no tienen usan Gauge. */
  icons?: Record<string, LucideIcon>;
  columns?: keyof typeof columnsClass;
  label?: string;
};

/**
 * Grilla de indicadores. Es un Server Component: los valores se formatean en
 * el servidor con lib/format.
 *
 *   <KpiGrid items={kpis} icons={{ ventas: Banknote }} />
 */
export function KpiGrid({ items, icons = {}, columns = 4, label = "Indicadores" }: KpiGridProps) {
  return (
    <section aria-label={label} className={columnsClass[columns]}>
      {items.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} icon={icons[kpi.id]} />
      ))}
    </section>
  );
}

export function KpiCard({ kpi, icon: Icon = Gauge }: { kpi: Kpi; icon?: LucideIcon }) {
  const TrendIcon = kpi.delta && kpi.delta.value < 0 ? TrendingDown : TrendingUp;

  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{kpi.label}</span>
      </p>
      <p className="mt-3 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
        {formatMetric(kpi.value, kpi.format)}
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {kpi.delta ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                kpi.delta.positive ? "text-success" : "text-danger",
              )}
            >
              <TrendIcon aria-hidden className="size-3.5" />
              {formatDelta(kpi.delta)}
            </span>
            {kpi.delta.period}
          </>
        ) : (
          kpi.hint
        )}
      </p>
    </Card>
  );
}

export function KpiGridSkeleton({ count = 4, columns = 4 }: { count?: number; columns?: keyof typeof columnsClass }) {
  return (
    <>
      <LoadingLabel>Cargando indicadores…</LoadingLabel>
      <StatGridSkeleton count={count} className={columnsClass[columns]} />
    </>
  );
}
