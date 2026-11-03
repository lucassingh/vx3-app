import { describe, expect, it } from "vitest";
import { type Area, AREAS, can, isRole, matrizDePermisos, type Role, ROLES } from "./permissions";

const TODAS = AREAS.map((area) => area.id);

/**
 * La matriz de solucion_doc/06 §4, escrita de otra forma que en el código (por
 * rol, qué edita y qué ve) para que el test no sea una copia del original.
 */
const ESPERADO: Record<Role, { edita: Area[]; ve: Area[] }> = {
  admin: { edita: TODAS, ve: [] },
  operaciones: {
    edita: ["conversaciones", "pedidos", "cobros", "envios", "catalogo", "compras"],
    ve: ["reclamos", "bot"],
  },
  postventa: { edita: ["conversaciones", "envios", "reclamos"], ve: ["pedidos", "catalogo"] },
  compras: { edita: ["catalogo", "compras"], ve: [] },
  marketing: { edita: ["pauta"], ve: ["conversaciones", "catalogo", "bot"] },
  solo_lectura: { edita: [], ve: ["pedidos", "cobros", "envios", "compras", "pauta"] },
};

describe("matriz rol × permiso", () => {
  for (const role of ROLES) {
    for (const area of TODAS) {
      const edita = ESPERADO[role].edita.includes(area);
      const ve = edita || ESPERADO[role].ve.includes(area);

      it(`${role} ${ve ? "ve" : "no ve"} y ${edita ? "edita" : "no edita"} ${area}`, () => {
        expect(can(role, `${area}.ver`)).toBe(ve);
        expect(can(role, `${area}.editar`)).toBe(edita);
      });
    }
  }

  it("solo admin administra la plataforma (usuarios, integraciones, IA)", () => {
    expect(ROLES.filter((role) => can(role, "plataforma.ver"))).toEqual(["admin"]);
  });
});

describe("roles", () => {
  it("isRole reconoce solo los roles de la app", () => {
    expect(isRole("postventa")).toBe(true);
    expect(isRole("user")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("la matriz para la pantalla tiene todos los roles y áreas", () => {
    const { roles, areas } = matrizDePermisos();
    expect(roles.map((role) => role.id)).toEqual([...ROLES]);
    expect(roles[0]).toEqual({ id: "admin", nombre: "Administración", quien: "Socios y Más Uno" });
    expect(areas).toHaveLength(AREAS.length);
    expect(areas.find((area) => area.id === "reclamos")?.permisos).toEqual({
      admin: "edita",
      operaciones: "ve",
      postventa: "edita",
      compras: "no",
      marketing: "no",
      solo_lectura: "no",
    });
  });
});
