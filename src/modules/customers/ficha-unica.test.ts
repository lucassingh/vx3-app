import { describe, expect, it } from "vitest";
import { unirFichas, type FichaDux } from "./ficha-unica";

const ficha = (duxId: number, cambios: Partial<FichaDux> = {}): FichaDux => ({
  duxId,
  name: `Ficha ${duxId}`,
  firstName: null,
  phone: "+541144445555",
  normalizedPhone: "1144445555",
  email: null,
  province: null,
  city: null,
  creadaEl: "2026-01-01",
  ultimaCompra: null,
  ...cambios,
});

describe("unirFichas", () => {
  it("una ficha es una clienta", () => {
    expect(unirFichas([ficha(1, { name: "Una", email: "una@correo.prueba" })])).toEqual({
      clientas: [
        {
          normalizedPhone: "1144445555",
          name: "Una",
          firstName: null,
          phone: "+541144445555",
          email: "una@correo.prueba",
          province: null,
          city: null,
          duxRecords: 1,
        },
      ],
      sinTelefono: 0,
    });
  });

  it("dos fichas con el mismo teléfono son una clienta", () => {
    const { clientas } = unirFichas([ficha(1), ficha(2), ficha(3, { normalizedPhone: "1155556666" })]);

    expect(clientas).toHaveLength(2);
    expect(clientas.find(({ normalizedPhone }) => normalizedPhone === "1144445555")?.duxRecords).toBe(2);
  });

  it("una ficha sin teléfono no entra, y se cuenta aparte", () => {
    const { clientas, sinTelefono } = unirFichas([
      ficha(1),
      ficha(2, { phone: null, normalizedPhone: null }),
      ficha(3, { phone: null, normalizedPhone: null }),
    ]);

    expect(clientas).toHaveLength(1);
    expect(sinTelefono).toBe(2);
  });

  it("el nombre lo da la ficha que compró hace menos", () => {
    const { clientas } = unirFichas([
      ficha(1, { name: "Vieja", ultimaCompra: "2026-01-10" }),
      ficha(2, { name: "Vigente", ultimaCompra: "2026-10-10", phone: "11-44445555" }),
      ficha(3, { name: "Sin compras" }),
    ]);

    expect(clientas[0]).toMatchObject({ name: "Vigente", phone: "11-44445555" });
  });

  it("sin compras, gana la ficha más nueva; y si no, la de ID más alto", () => {
    const fechas = unirFichas([ficha(5, { name: "Vieja", creadaEl: "2025-01-01" }), ficha(1, { name: "Nueva" })]);
    const empate = unirFichas([ficha(1, { name: "Menor" }), ficha(2, { name: "Mayor" })]);

    expect(fechas.clientas[0]?.name).toBe("Nueva");
    expect(empate.clientas[0]?.name).toBe("Mayor");
  });

  it("lo que le falta a la ficha vigente lo completa otra", () => {
    const { clientas } = unirFichas([
      ficha(1, { email: "vieja@correo.prueba", province: "Córdoba", city: "Río Cuarto" }),
      ficha(2, { province: "Buenos Aires", ultimaCompra: "2026-10-10" }),
    ]);

    expect(clientas[0]).toMatchObject({ email: "vieja@correo.prueba", province: "Buenos Aires", city: "Río Cuarto" });
  });

  it("el nombre de pila no se mezcla: si dos personas comparten teléfono, no se saluda a una con el de la otra", () => {
    const { clientas } = unirFichas([
      ficha(1, { firstName: "Otra" }),
      ficha(2, { firstName: null, ultimaCompra: "2026-10-10" }),
    ]);

    expect(clientas[0]?.firstName).toBeNull();
  });

  it("sin fichas, no hay clientas", () => {
    expect(unirFichas([])).toEqual({ clientas: [], sinTelefono: 0 });
  });
});
