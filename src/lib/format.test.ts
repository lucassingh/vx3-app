import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDelta,
  formatMetric,
  formatRatio,
  formatRelativeTime,
  formatUsd,
  primerNombre,
} from "./format";

// Estos tests asumen siteConfig.locale = "es-AR". El espacio antes de "%"
// cambia según la versión de ICU (Node vs. navegador), por eso es opcional.

describe("formatMetric", () => {
  it("formatea números y porcentajes", () => {
    expect(formatMetric(1284, "number")).toBe("1.284");
    expect(formatMetric(0.032, "percent")).toMatch(/^3,2\s?%$/);
  });
});

describe("formatDelta", () => {
  it("agrega el signo y la unidad", () => {
    const period = "vs. mes anterior";
    expect(formatDelta({ value: 0.124, unit: "percent", period, positive: true })).toMatch(/^\+12,4\s?%$/);
    expect(formatDelta({ value: -0.4, unit: "points", period, positive: false })).toBe("−0,4 pp");
    expect(formatDelta({ value: 18, unit: "number", period, positive: true })).toBe("+18");
  });
});

describe("monedas e índices", () => {
  it("formatea pesos sin decimales, dólares y el RM", () => {
    expect(formatCurrency(45_000)).toMatch(/^\$\s?45\.000$/);
    expect(formatUsd(38)).toMatch(/US\$\s?38/);
    expect(formatRatio(1.294)).toBe("1,29");
    expect(formatMetric(1.5, "ratio")).toBe("1,50");
  });
});

describe("formatDate", () => {
  it("no corre las fechas un día por la zona horaria", () => {
    expect(formatDate("2026-10-24", { day: "numeric", month: "long" })).toBe("24 de octubre");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  it("elige la unidad más grande que corresponda", () => {
    expect(formatRelativeTime(ago(5), now)).toBe("hace 5 minutos");
    expect(formatRelativeTime(ago(180), now)).toBe("hace 3 horas");
    expect(formatRelativeTime(ago(24 * 60), now)).toBe("ayer");
  });
});

describe("primerNombre", () => {
  it("toma el primer nombre, aunque haya espacios de más", () => {
    expect(primerNombre("Johana Quiroga")).toBe("Johana");
    expect(primerNombre("  Romina  Belén Gaitán ")).toBe("Romina");
    expect(primerNombre("Lucía")).toBe("Lucía");
  });
});
