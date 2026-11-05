import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import { guardarClientas } from "./espejo-clientas";
import { recalcularClientas } from "./fichas";

const db = getDb();
const AHORA = new Date("2026-11-04T12:00:00Z");

const clienta = (id: number, cambios: Partial<ErpClienta> = {}): ErpClienta => ({
  id,
  nombre: `NOMBRE REAL ${id}`,
  nombrePila: "REAL",
  telefono: "+5491144445555",
  email: null,
  provincia: "Buenos Aires",
  localidad: "Localidad Real",
  habilitada: true,
  creadaEl: "2026-01-15",
  ...cambios,
});

let serie = 0;
async function compra(customerDuxId: number, issuedOn: string, cambios: { cancelled?: boolean; type?: string } = {}) {
  serie += 1;
  await db.duxInvoice.create({
    data: {
      id: newId(),
      duxId: serie,
      branchId: 1,
      type: cambios.type ?? "COMPROBANTE_VENTA",
      letter: "X",
      pointOfSale: "2",
      number: serie,
      issuedOn: new Date(`${issuedOn}T00:00:00Z`),
      customerDuxId,
      totalCents: 0n,
      cancelled: cambios.cancelled ?? false,
      contentHash: "x",
      firstSeenAt: AHORA,
      changedAt: AHORA,
    },
  });
}

const limpiar = async () => {
  await db.customer.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxCustomer.deleteMany();
};

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  await limpiar();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("recalcularClientas", () => {
  it("dos formatos del mismo número son una clienta, y una ficha sin teléfono no entra", async () => {
    await guardarClientas(
      [
        clienta(1, { telefono: "+5491144445555" }),
        clienta(2, { telefono: "11-44445555" }),
        clienta(3, { telefono: null }),
        clienta(4, { telefono: "1155556666" }),
      ],
      AHORA,
    );

    expect(await recalcularClientas(AHORA)).toMatchObject({ clientas: 2, nuevas: 2, sinTelefono: 1 });

    const unida = await db.customer.findUniqueOrThrow({ where: { normalizedPhone: "1144445555" } });
    expect(unida.duxRecords).toBe(2);
    expect(await db.customer.count()).toBe(2);
  });

  it("el nombre lo da la ficha que compró hace menos, sin contar anuladas ni notas de crédito", async () => {
    await guardarClientas([clienta(1, { nombre: "VIEJA" }), clienta(2, { nombre: "VIGENTE" })], AHORA);
    await compra(1, "2026-01-10");
    await compra(2, "2026-06-10");
    await compra(1, "2026-10-01", { cancelled: true });
    await compra(1, "2026-10-02", { type: "NOTA_CREDITO" });

    await recalcularClientas(AHORA);

    expect((await db.customer.findFirstOrThrow()).name).toBe("VIGENTE");
  });

  it("repetirlo no cambia nada: conserva el ID y no toca la fila", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await recalcularClientas(AHORA);
    const antes = await db.customer.findFirstOrThrow();

    const resultado = await recalcularClientas(new Date("2026-11-05T12:00:00Z"));

    expect(resultado).toMatchObject({ clientas: 1, nuevas: 0, cambiadas: 0, quitadas: 0 });
    const despues = await db.customer.findFirstOrThrow();
    expect(despues.id).toBe(antes.id);
    expect(despues.changedAt).toEqual(antes.changedAt);
  });

  it("si cambia un dato de la ficha, cambia la clienta, con el mismo ID", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await recalcularClientas(AHORA);
    const antes = await db.customer.findFirstOrThrow();

    await guardarClientas([clienta(1, { email: "nuevo@correo.prueba" })], AHORA);
    const resultado = await recalcularClientas(AHORA);

    expect(resultado.cambiadas).toBe(1);
    expect(await db.customer.findFirstOrThrow()).toMatchObject({ id: antes.id, email: "nuevo@correo.prueba" });
  });

  it("si DUX le cambia el teléfono, la clienta vieja se quita y aparece la nueva", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await recalcularClientas(AHORA);

    await guardarClientas([clienta(1, { telefono: "1155556666" })], AHORA);

    expect(await recalcularClientas(AHORA)).toMatchObject({ clientas: 1, nuevas: 1, quitadas: 1 });
    expect((await db.customer.findFirstOrThrow()).normalizedPhone).toBe("1155556666");
  });

  it("guarda el nombre de pila", async () => {
    await guardarClientas([clienta(1, { nombrePila: "María" })], AHORA);

    await recalcularClientas(AHORA);

    expect((await db.customer.findFirstOrThrow()).firstName).toBe("María");
  });

  it("sin fichas, no hay clientas", async () => {
    expect(await recalcularClientas(AHORA)).toEqual({
      clientas: 0,
      nuevas: 0,
      cambiadas: 0,
      quitadas: 0,
      sinTelefono: 0,
      sinCompras: 0,
      segmentos: { nueva: 0, activa: 0, top: 0, en_riesgo: 0, dormida: 0 },
    });
  });

  it("cuando cambian todas a la vez, entra en una transacción", async () => {
    const muchas = Array.from({ length: 3_000 }, (_, indice) =>
      clienta(indice + 1, { telefono: String(1_100_000_000 + indice) }),
    );
    await guardarClientas(muchas, AHORA);
    await recalcularClientas(AHORA);

    await db.duxCustomer.updateMany({ data: { email: "nuevo@correo.prueba" } });

    expect(await recalcularClientas(AHORA)).toMatchObject({ clientas: 3_000, cambiadas: 3_000 });
    expect(await db.customer.count({ where: { email: "nuevo@correo.prueba" } })).toBe(3_000);
  }, 60_000);
});

describe("métricas y segmento", () => {
  /** Un comprobante con una línea de $100 y costo de $75. */
  async function compraConLinea(
    customerDuxId: number,
    issuedOn: string,
    cambios: { cancelled?: boolean; type?: string } = {},
  ) {
    serie += 1;
    await db.duxInvoice.create({
      data: {
        id: newId(),
        duxId: serie,
        branchId: 1,
        type: cambios.type ?? "COMPROBANTE_VENTA",
        letter: "X",
        pointOfSale: "2",
        number: serie,
        issuedOn: new Date(`${issuedOn}T00:00:00Z`),
        customerDuxId,
        totalCents: 10_000n,
        cancelled: cambios.cancelled ?? false,
        contentHash: "x",
        firstSeenAt: AHORA,
        changedAt: AHORA,
        items: {
          create: {
            id: newId(),
            line: 0,
            code: "LN25",
            kind: "prenda",
            baseCode: "LN25",
            name: "Prenda",
            quantity: "1",
            unitPriceCents: 10_000n,
            discountPct: "0",
            vatPct: "0",
            costCents: 7_500n,
          },
        },
      },
    });
  }

  it("suma las compras de todas sus fichas, y el mismo día es una compra", async () => {
    await guardarClientas([clienta(1, { telefono: "+5491144445555" }), clienta(2, { telefono: "11-44445555" })], AHORA);
    await compraConLinea(1, "2026-10-01");
    await compraConLinea(2, "2026-10-01");
    await compraConLinea(2, "2026-10-21");

    await recalcularClientas(AHORA);

    expect(await db.customer.findFirstOrThrow()).toMatchObject({
      purchases: 2,
      totalCents: 30_000n,
      marginCents: 7_500n,
      margin12mCents: 7_500n,
      firstPurchaseOn: new Date("2026-10-01T00:00:00Z"),
      lastPurchaseOn: new Date("2026-10-21T00:00:00Z"),
      cycleDays: 20,
      segment: "top",
    });
  });

  it("no cuenta anuladas ni notas de crédito", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await compraConLinea(1, "2026-10-01");
    await compraConLinea(1, "2026-10-02", { cancelled: true });
    await compraConLinea(1, "2026-10-03", { type: "NOTA_CREDITO" });

    await recalcularClientas(AHORA);

    expect(await db.customer.findFirstOrThrow()).toMatchObject({
      purchases: 1,
      totalCents: 10_000n,
      lastPurchaseOn: new Date("2026-10-01T00:00:00Z"),
    });
  });

  it("sin compras válidas queda sin segmento, y se cuenta aparte", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await compraConLinea(1, "2026-10-02", { cancelled: true });

    expect(await recalcularClientas(AHORA)).toMatchObject({
      sinCompras: 1,
      segmentos: { nueva: 0, activa: 0, top: 0, en_riesgo: 0, dormida: 0 },
    });
    expect(await db.customer.findFirstOrThrow()).toMatchObject({
      purchases: 0,
      totalCents: 0n,
      firstPurchaseOn: null,
      lastPurchaseOn: null,
      cycleDays: null,
      segment: null,
    });
  });

  it("el segmento cambia con el paso de los días, aunque no cambie nada más", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await compraConLinea(1, "2026-10-01");
    await recalcularClientas(AHORA);
    expect((await db.customer.findFirstOrThrow()).segment).toBe("nueva");

    const resultado = await recalcularClientas(new Date("2026-12-15T12:00:00Z"));

    expect(resultado).toMatchObject({ cambiadas: 1, segmentos: { en_riesgo: 1 } });
    expect((await db.customer.findFirstOrThrow()).segment).toBe("en_riesgo");
  });

  it("repetirlo con compras no toca las filas", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await compraConLinea(1, "2026-10-01");
    await recalcularClientas(AHORA);
    const antes = await db.customer.findFirstOrThrow();

    expect(await recalcularClientas(AHORA)).toMatchObject({ nuevas: 0, cambiadas: 0, quitadas: 0 });

    expect((await db.customer.findFirstOrThrow()).changedAt).toEqual(antes.changedAt);
  });
});

describe("fuera de producción", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENV", "qa");
  });

  it("no aparece ningún dato real", async () => {
    await guardarClientas([clienta(7, { email: "real@correo.prueba" })], AHORA);

    await recalcularClientas(AHORA);

    const fila = await db.customer.findFirstOrThrow();
    const texto = JSON.stringify(fila, (_, valor) => (typeof valor === "bigint" ? String(valor) : valor));
    expect(texto).not.toContain("REAL");
    expect(texto).not.toContain("Real");
    expect(texto).not.toContain("real@");
    expect(texto).not.toContain("44445555");
    expect(fila).toMatchObject({
      name: "Clienta 7",
      firstName: null,
      email: "clienta-7@anonimizada.invalid",
      city: null,
      normalizedPhone: expect.stringMatching(/^00\d{8}$/),
    });
  });

  it("dos fichas de la misma persona siguen siendo una, aunque el teléfono sea falso", async () => {
    await guardarClientas([clienta(1, { telefono: "+5491144445555" }), clienta(2, { telefono: "11-44445555" })], AHORA);

    expect(await recalcularClientas(AHORA)).toMatchObject({ clientas: 1 });
    expect((await db.customer.findFirstOrThrow()).duxRecords).toBe(2);
  });
});
