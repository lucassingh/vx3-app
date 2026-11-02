"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ChartBar = {
  value: number;
  /** Valor ya formateado para tooltip y lectores ("$ 1.240.000", "16 pedidos"). */
  valueLabel: string;
  /** Texto completo para tooltip y lectores de pantalla ("jueves, 23 de octubre"). */
  label: string;
  /** Texto corto para el eje X ("23 oct"). */
  axisLabel: string;
};

type ColumnChartProps = {
  bars: ChartBar[];
  /** Techo del eje Y (usar niceMax de lib/chart en el servidor). */
  max: number;
  /** Etiquetas del eje Y de arriba hacia abajo: techo, mitad y cero. */
  ticks: [string, string, string];
  /** Qué se mide, para el grupo accesible ("ventas por día"). */
  description: string;
};

/**
 * Columnas con tooltip en hover y foco. Navegable con flechas, Inicio y Fin;
 * cada barra anuncia su fecha y valor a lectores de pantalla. Todos los textos
 * llegan formateados desde el servidor (sin diferencias al hidratar).
 */
export function ColumnChart({ bars, max, ticks, description }: ColumnChartProps) {
  const last = bars.length - 1;

  const [focusIndex, setFocusIndex] = useState(last);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const barRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const targets: Record<string, number> = {
      ArrowRight: focusIndex + 1,
      ArrowLeft: focusIndex - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const next = Math.min(last, Math.max(0, targets[event.key]));
    barRefs.current[next]?.focus();
  };

  const active = activeIndex === null ? null : { index: activeIndex, ...bars[activeIndex] };
  const align =
    active === null || (active.index >= 3 && active.index <= last - 3)
      ? "-translate-x-1/2"
      : active.index < 3
        ? "-translate-x-3"
        : "-translate-x-[calc(100%-0.75rem)]";

  return (
    <div className="grid h-full min-h-60 grid-cols-[auto_1fr] grid-rows-[1fr_auto] gap-x-3 gap-y-2">
      <div
        aria-hidden
        className="-my-1.5 flex flex-col justify-between text-right text-[11px] leading-none tabular-nums text-muted-foreground"
      >
        {ticks.map((tick, index) => (
          <span key={index}>{tick}</span>
        ))}
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {ticks.map((_, index) => (
            <div key={index} className="h-px bg-border" />
          ))}
        </div>

        <div
          role="group"
          aria-label={`${description}, últimos ${bars.length} días. Usá las flechas para recorrerlos.`}
          onKeyDown={onKeyDown}
          onPointerLeave={() => setActiveIndex(null)}
          className="absolute inset-0 flex items-end"
        >
          {bars.map((bar, index) => (
            <button
              key={index}
              ref={(node) => {
                barRefs.current[index] = node;
              }}
              type="button"
              tabIndex={index === focusIndex ? 0 : -1}
              aria-label={`${bar.label}: ${bar.valueLabel}`}
              onPointerEnter={() => setActiveIndex(index)}
              onFocus={() => {
                setFocusIndex(index);
                setActiveIndex(index);
              }}
              onBlur={() => setActiveIndex(null)}
              className="flex h-full flex-1 cursor-default items-end justify-center rounded-md focus-visible:outline-offset-0"
            >
              <span
                className={cn(
                  "w-[68%] max-w-6 origin-bottom animate-bar-grow rounded-t-[4px] bg-primary transition-opacity duration-150",
                  activeIndex !== null && activeIndex !== index && "opacity-35",
                )}
                style={{
                  height: `${(bar.value / max) * 100}%`,
                  animationDelay: `${index * 10}ms`,
                }}
              />
            </button>
          ))}
        </div>

        {active && (
          <div
            aria-hidden
            className={cn("pointer-events-none absolute z-10 -translate-y-full", align)}
            style={{
              left: `${((active.index + 0.5) / bars.length) * 100}%`,
              bottom: `calc(${(active.value / max) * 100}% + 0.5rem)`,
            }}
          >
            <div className="whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-popover">
              <p className="text-sm font-semibold tabular-nums">{active.valueLabel}</p>
              <p className="text-xs text-muted-foreground first-letter:uppercase">
                {active.label}
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        aria-hidden
        className="col-start-2 flex justify-between text-[11px] text-muted-foreground"
      >
        <span>{bars[0]?.axisLabel}</span>
        <span>{bars[Math.round(last / 2)]?.axisLabel}</span>
        <span>{bars[last]?.axisLabel}</span>
      </div>
    </div>
  );
}
