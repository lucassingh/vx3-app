/** Techo "redondo" y par para el eje Y (18 → 20, 7 → 8, 1.340.000 → 2.000.000). */
export function niceMax(value: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  const max = Math.ceil(value / step) * step;
  return max % 2 === 0 ? max : max + step;
}
