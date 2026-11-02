import { formatNumber } from "@/lib/format";

/**
 * Porcentaje para Client Components que también se renderizan en el servidor:
 * el espacio antes de "%" de Intl cambia entre versiones de ICU (Node y el
 * navegador), así que acá se arma a mano y se hidrata igual en los dos.
 */
export function porcentaje(value: number, maximumFractionDigits = 1) {
  return `${formatNumber(value * 100, { maximumFractionDigits })} %`;
}
