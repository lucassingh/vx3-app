/** Las semillas expresan el tiempo como "hace N minutos"; esto lo pasa a fechas. */

export const HOUR = 60;
export const DAY = 24 * HOUR;

/** Fecha y hora ISO de hace `minutes` minutos. */
export function isoAgo(minutes: number, now: number) {
  return new Date(now - minutes * 60_000).toISOString();
}

/** Fecha ISO (YYYY-MM-DD) de hace `days` días. */
export function dateAgo(days: number, now: number) {
  return new Date(now - days * DAY * 60_000).toISOString().slice(0, 10);
}

/** Serie diaria de `values` que termina hoy (el último valor es hoy). */
export function dailySeries(values: number[], now: number) {
  return values.map((value, index) => ({ date: dateAgo(values.length - 1 - index, now), value }));
}
