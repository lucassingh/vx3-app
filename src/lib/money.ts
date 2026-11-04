import { formatCurrency } from "./format";

/**
 * Montos en pesos, guardados en centavos como bigint: sin errores de coma
 * flotante. Con number, 200.000 × 1,1765 da 235.300,00000000003 y el redondeo
 * a $100 lo lleva a 235.400; con Money da 235.300.
 *
 * Es inmutable: cada operación devuelve un Money nuevo. Las multiplicaciones y
 * divisiones redondean al centavo (por defecto, la mitad hacia arriba).
 */

/** "half-up": al más cercano, la mitad lejos del cero · "up": hacia +∞ · "down": hacia −∞. */
export type Rounding = "half-up" | "up" | "down";

const CENTS_PER_PESO = 100n;

export class Money {
  static readonly ZERO = new Money(0n);

  private constructor(readonly cents: bigint) {}

  static fromCents(cents: bigint | number) {
    if (typeof cents === "number" && !Number.isSafeInteger(cents)) {
      throw new RangeError(`Los centavos tienen que ser un entero: ${cents}`);
    }
    return new Money(BigInt(cents));
  }

  /**
   * Un number se redondea al centavo (los costos que vienen de una cuenta con
   * number traen decimales de más). Un string tiene que tener a lo sumo dos
   * decimales, con punto: "1234.5" o "-80".
   */
  static fromPesos(pesos: number | string) {
    if (typeof pesos === "string") {
      const { units, scale } = parseDecimal(pesos);
      if (scale > 2) throw new RangeError(`Un monto tiene a lo sumo dos decimales: "${pesos}"`);
      return new Money(units * 10n ** BigInt(2 - scale));
    }
    if (!Number.isFinite(pesos)) throw new RangeError(`Monto inválido: ${pesos}`);
    const cents = Math.round(Math.abs(pesos) * 100);
    if (!Number.isSafeInteger(cents)) throw new RangeError(`Monto fuera de rango: ${pesos}`);
    return new Money(BigInt(Math.sign(pesos) * cents));
  }

  static sum(values: Iterable<Money>) {
    let cents = 0n;
    for (const value of values) cents += value.cents;
    return new Money(cents);
  }

  plus(other: Money) {
    return new Money(this.cents + other.cents);
  }

  minus(other: Money) {
    return new Money(this.cents - other.cents);
  }

  /** Por un coeficiente exacto: 1.3, "1.5475". El número se toma tal como se escribe. */
  times(factor: number | string, rounding: Rounding = "half-up") {
    const { units, scale } = parseDecimal(String(factor));
    return new Money(divide(this.cents * units, 10n ** BigInt(scale), rounding));
  }

  /** Entre un entero: la docena ÷ 12. */
  dividedBy(divisor: number, rounding: Rounding = "half-up") {
    if (!Number.isSafeInteger(divisor) || divisor === 0) {
      throw new RangeError(`Se divide por un entero distinto de cero: ${divisor}`);
    }
    return new Money(divide(this.cents, BigInt(divisor), rounding));
  }

  /** Hacia arriba al múltiplo de `pesos` (RN-13: todos los precios, a $100). Uno exacto queda igual. */
  roundUpTo(pesos: number) {
    if (!Number.isSafeInteger(pesos) || pesos <= 0) throw new RangeError(`El múltiplo es un entero positivo: ${pesos}`);
    const step = BigInt(pesos) * CENTS_PER_PESO;
    return new Money(divide(this.cents, step, "up") * step);
  }

  compare(other: Money): -1 | 0 | 1 {
    return this.cents < other.cents ? -1 : this.cents > other.cents ? 1 : 0;
  }

  equals(other: Money) {
    return this.cents === other.cents;
  }

  isZero() {
    return this.cents === 0n;
  }

  isNegative() {
    return this.cents < 0n;
  }

  /** En pesos, para gráficos y para lo que todavía trabaja con number. */
  toPesos() {
    return Number(this.cents) / 100;
  }

  /** "$ 1.234" o "$ 1.234,50": los centavos se muestran solo si hay. */
  format() {
    const digits = this.cents % CENTS_PER_PESO === 0n ? 0 : 2;
    return formatCurrency(this.toPesos(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /** "1234.50": exacto, para JSON y para la base. */
  toString() {
    const sign = this.cents < 0n ? "-" : "";
    const abs = this.cents < 0n ? -this.cents : this.cents;
    return `${sign}${abs / CENTS_PER_PESO}.${String(abs % CENTS_PER_PESO).padStart(2, "0")}`;
  }

  toJSON() {
    return this.toString();
  }
}

/** "1.5475" → 15475 con 4 decimales. Sin notación exponencial ni separadores de miles. */
function parseDecimal(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Número inválido: "${value}"`);
  const [, sign = "", integer = "", fraction = ""] = match;
  return { units: BigInt(`${sign}${integer}${fraction}`), scale: fraction.length };
}

function divide(numerator: bigint, denominator: bigint, rounding: Rounding) {
  if (denominator < 0n) return divide(-numerator, -denominator, rounding);
  // La división de bigint trunca hacia el cero.
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;

  switch (rounding) {
    case "down":
      return numerator < 0n ? quotient - 1n : quotient;
    case "up":
      return numerator < 0n ? quotient : quotient + 1n;
    case "half-up": {
      const twice = (remainder < 0n ? -remainder : remainder) * 2n;
      if (twice < denominator) return quotient;
      return numerator < 0n ? quotient - 1n : quotient + 1n;
    }
  }
}
