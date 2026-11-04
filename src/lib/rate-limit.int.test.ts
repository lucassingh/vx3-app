import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { limiteCompartido, reservarTurno } from "./rate-limit";

const db = getDb();
const clave = (nombre: string) => `prueba:${nombre}:${Date.now()}`;

afterAll(async () => {
  await db.rateLimit.deleteMany({ where: { key: { startsWith: "prueba:" } } });
  await db.$disconnect();
});

describe("límite compartido", () => {
  it("el primer turno sale enseguida", async () => {
    expect(await reservarTurno(clave("primero"), 1_000)).toBeLessThan(50);
  });

  it("varios clientes a la vez reciben turnos distintos, separados por el intervalo", async () => {
    // Reservar no duerme: un intervalo largo no alarga el test, y deja la demora de la red muy por debajo.
    const intervalo = 10_000;
    const fija = clave("fija");
    const turnos = (await Promise.all(Array.from({ length: 6 }, () => reservarTurno(fija, intervalo)))).toSorted(
      (a, b) => a - b,
    );

    for (let i = 1; i < turnos.length; i++) {
      expect(turnos[i]! - turnos[i - 1]!).toBeGreaterThan(intervalo - 3_000);
    }
  });

  it("dos instancias que usan el límite no lo pasan", async () => {
    const intervalo = 1_000;
    const fija = clave("instancias");
    const a = limiteCompartido(fija, intervalo);
    const b = limiteCompartido(fija, intervalo);
    const salidas: number[] = [];
    const usar = async (limite: typeof a) => {
      await limite.turno();
      salidas.push(performance.now());
    };

    await Promise.all([usar(a), usar(b), usar(a), usar(b)]);

    const orden = salidas.toSorted((x, y) => x - y);
    // Cuatro salidas son tres intervalos. El margen es por la demora de la red en la primera.
    expect(orden.at(-1)! - orden[0]!).toBeGreaterThan(intervalo * 3 - 1_000);
  });

  it("claves distintas no se frenan entre sí", async () => {
    await reservarTurno(clave("v2"), 5_000);
    expect(await reservarTurno(clave("v1"), 5_000)).toBeLessThan(50);
  });

  it("postergar corre el próximo turno, y nunca lo adelanta", async () => {
    const fija = clave("postergar");
    const limite = limiteCompartido(fija, 100);

    await limite.postergar(2_000);
    expect(await reservarTurno(fija, 100)).toBeGreaterThan(1_500);

    await limite.postergar(1);
    expect(await reservarTurno(fija, 100)).toBeGreaterThan(1_500);
  });
});
