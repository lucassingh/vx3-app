import { siteConfig } from "@/config/site";
import type { Kpi, MetricFormat } from "@/lib/api/types";

const { locale } = siteConfig;
const MINUS = "−";

/** Usa el signo menos tipográfico (−) en lugar del guion. */
const withMinus = (value: string) => value.replace("-", MINUS);

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** 0.124 → "12,4 %". */
export function formatPercent(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

/** 45000 → "$ 45.000". Pesos sin decimales salvo que se pidan. */
export function formatCurrency(value: number, options?: Intl.NumberFormatOptions) {
  return withMinus(
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
      ...options,
    }).format(value),
  );
}

/** 1002000 → "$ 1 M"; para ejes y textos cortos. */
export function formatCurrencyCompact(value: number) {
  return formatCurrency(value, { notation: "compact", maximumFractionDigits: 1 });
}

/** El gasto de Meta está en dólares (RN-111). 38 → "US$ 38". */
export function formatUsd(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

/** Índices como el RM: 1.294 → "1,29". */
export function formatRatio(value: number) {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMetric(value: number, format: MetricFormat) {
  switch (format) {
    case "percent":
      return formatPercent(value);
    case "currency":
      return formatCurrency(value);
    case "usd":
      return formatUsd(value);
    case "ratio":
      return formatRatio(value);
    default:
      return formatNumber(value);
  }
}

/** Variación con signo: "+12,4 %", "−0,4 pp", "+18", "+$ 120.000". */
export function formatDelta({ value, unit }: NonNullable<Kpi["delta"]>) {
  const signed = { signDisplay: "exceptZero", maximumFractionDigits: 1 } as const;
  if (unit === "percent") return withMinus(formatPercent(value, signed));
  if (unit === "points") return `${withMinus(formatNumber(value, signed))} pp`;
  if (unit === "currency") return formatCurrency(value, { signDisplay: "exceptZero" });
  return withMinus(formatNumber(value, signed));
}

/** Fechas sin hora (YYYY-MM-DD): se formatean en UTC para no correrse un día. */
export function formatDate(isoDate: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(
    new Date(isoDate),
  );
}

/** Hora local de Buenos Aires de una fecha ISO: "14:35". */
export function formatTime(isoDateTime: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(isoDateTime));
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "hace 5 minutos", "ayer", "hace 2 semanas". */
export function formatRelativeTime(isoDateTime: string, now = Date.now()) {
  const seconds = Math.round((new Date(isoDateTime).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(0, "minute");
}
