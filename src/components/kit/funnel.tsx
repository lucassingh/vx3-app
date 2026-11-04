import { formatNumber, formatPercent } from "@/lib/format";

export type FunnelStep = {
  id: string;
  label: string;
  value: number;
};

/**
 * Embudo horizontal: cada paso con su volumen y la conversión desde el paso
 * anterior. El ancho de cada barra es relativo al primer paso.
 */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const first = Math.max(1, steps[0]?.value ?? 1);

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const previous = steps[index - 1];
        const rate = previous && previous.value > 0 ? step.value / previous.value : null;
        return (
          <li
            key={step.id}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]"
          >
            <span className="truncate text-muted-foreground">{step.label}</span>
            <span aria-hidden className="h-7 overflow-hidden rounded-md bg-primary/8">
              <span
                className="flex h-full items-center rounded-md bg-primary/80 px-2 text-[11px] font-medium text-primary-foreground"
                style={{ width: `${Math.max(4, (step.value / first) * 100)}%` }}
              />
            </span>
            <span className="w-28 text-right tabular-nums">
              <span className="font-medium">{formatNumber(step.value)}</span>
              {rate !== null && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {formatPercent(rate, { maximumFractionDigits: 0 })}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
