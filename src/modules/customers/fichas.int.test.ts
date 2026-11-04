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
    });
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
