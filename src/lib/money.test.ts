import { describe, expect, it } from "vitest";
import { Money } from "./money";

const pesos = (value: number | string) => Money.fromPesos(value);

describe("Money", () => {
  it("guarda centavos exactos: 0,1 + 0,2 es 0,3", () => {
    expect(pesos(0.1).plus(pesos(0.2)).equals(pesos("0.3"))).toBe(true);
    expect(pesos("1234.5").cents).toBe(123450n);
    expect(pesos("-80").cents).toBe(-8000n);
  });

  it("un number se redondea al centavo; un string con más de dos decimales es un error", () => {
    expect(pesos(61900.00000000001).cents).toBe(6190000n);
    expect(pesos(-10.005).cents).toBe(-1001n);
    expect(() => pesos("10.005")).toThrow(RangeError);
    expect(() => pesos("1.234,50")).toThrow(RangeError);
    expect(() => pesos(Number.NaN)).toThrow(RangeError);
    expect(() => Money.fromCents(10.5)).toThrow(RangeError);
  });

  it("multiplica por el coeficiente exacto: 40.000 × 1,5475 = 61.900 (con number da 61.900,00000000001)", () => {
    expect(40_000 * 1.5475).not.toBe(61_900);
    expect(pesos(40_000).times(1.5475).toString()).toBe("61900.00");
    expect(pesos(40_000).times("1.5475").equals(pesos(61_900))).toBe(true);
  });

  it("redondea al centavo según el modo, también con negativos", () => {
    const unPeso = pesos(1);
    expect(unPeso.times("0.005").cents).toBe(1n); // 0,5 centavos → 1 (la mitad lejos del cero)
    expect(unPeso.times("0.004").cents).toBe(0n);
    expect(unPeso.times("0.001", "up").cents).toBe(1n);
    expect(unPeso.times("0.009", "down").cents).toBe(0n);
    expect(pesos(-1).times("0.005").cents).toBe(-1n);
    expect(pesos(-1).times("0.001", "up").cents).toBe(0n);
    expect(pesos(-1).times("0.001", "down").cents).toBe(-1n);
    expect(() => unPeso.times(1e-7)).toThrow(RangeError);
  });

  it("divide entre un entero: la docena ÷ 12", () => {
    expect(pesos(10_000).dividedBy(12).toString()).toBe("833.33");
    expect(pesos(10_000).dividedBy(12, "up").toString()).toBe("833.34");
    expect(pesos(10).dividedBy(-4).toString()).toBe("-2.50");
    expect(() => pesos(1).dividedBy(0)).toThrow(RangeError);
    expect(() => pesos(1).dividedBy(1.5)).toThrow(RangeError);
  });

  it("RN-13: redondea hacia arriba a $100; un múltiplo exacto queda igual", () => {
    expect(pesos("22100.01").roundUpTo(100).toString()).toBe("22200.00");
    expect(pesos(22_100).roundUpTo(100).toString()).toBe("22100.00");
    expect(pesos("0.01").roundUpTo(100).toString()).toBe("100.00");
    expect(Money.ZERO.roundUpTo(100).isZero()).toBe(true);
    expect(pesos(-150).roundUpTo(100).toString()).toBe("-100.00");
    expect(pesos(1_234).roundUpTo(500).toString()).toBe("1500.00");
    expect(() => pesos(1).roundUpTo(0)).toThrow(RangeError);
  });

  it("suma, compara y formatea", () => {
    const total = Money.sum([pesos(100), pesos("0.50"), pesos(-20)]);
    expect(total.toString()).toBe("80.50");
    expect(total.compare(pesos(80))).toBe(1);
    expect(pesos(80).compare(total)).toBe(-1);
    expect(total.compare(pesos("80.5"))).toBe(0);
    expect(Money.sum([]).isZero()).toBe(true);
    expect(pesos(-1).isNegative()).toBe(true);
    expect(pesos(45_000).format()).toMatch(/^\$\s?45\.000$/);
    expect(pesos("45000.5").format()).toMatch(/^\$\s?45\.000,50$/);
    expect(pesos(-5).format()).toMatch(/^−\$\s?5$/);
    expect(pesos("0.05").toString()).toBe("0.05");
    expect(pesos("-0.05").toString()).toBe("-0.05");
    expect(JSON.stringify({ total })).toBe('{"total":"80.50"}');
    expect(total.toPesos()).toBe(80.5);
  });
});
