import { beforeEach, describe, expect, it } from "vitest";
import type {
  ApiErrorBody,
  CatalogoAltaInput,
  CatalogoAltaOpciones,
  CatalogoCombosResultado,
  CatalogoFicha,
} from "@/lib/api/types";
import { resetDb } from "../db";
import { handleMockRequest, MOCK_API_PREFIX } from "../router";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

const input: CatalogoAltaInput = {
  sku: "CJATN42",
  rubro: "Conjuntos",
  subrubro: "Armado tres piezas",
  nombre: "CONJUNTO ARMADO TRES PIEZAS CONDEZA CON PUNTILLA",
  marca: "Condeza",
  proveedorId: "p-bethy",
  tela: "Encaje",
  colores: ["Negro", "Blanco"],
  talles: "85 a 105",
  prenda: "CONJUNTO ARMADO TRES PIEZAS CON PUNTILLA",
  color: "COLORES Y DISEÑOS DE LA FOTO",
  copa: "",
  atributos: {},
  opcionales: {},
  fotos: [],
  costoDocena: 58_000,
  pesoBultoKg: 0.7,
  medidasCm: [32, 18, 9],
};

beforeEach(() => {
  resetDb();
});

describe("catálogo", () => {
  it("sugiere el próximo SKU correlativo del subrubro en DUX", async () => {
    const { body } = await call<CatalogoAltaOpciones>("/catalogo/alta/opciones");
    const sub = body.rubros
      .find((r) => r.rubro === "Conjuntos")
      ?.subrubros.find((s) => s.nombre === "Armado tres piezas");
    expect(sub).toMatchObject({ prefijo: "CJATN", proximoSku: "CJATN42" });
  });

  it("bloquea el alta con un SKU que termina en pack (RN-98) y publica uno válido", async () => {
    const invalido = await call<ApiErrorBody>(
      "/catalogo/alta/publicar",
      post({ input: { ...input, sku: "CJATN42-6" }, paso: "dux" }),
    );
    expect(invalido.status).toBe(422);

    for (const paso of ["dux", "precios", "tiendanube"]) {
      expect((await call("/catalogo/alta/publicar", post({ input, paso }))).status).toBe(200);
    }
    const { body } = await call<CatalogoFicha>("/catalogo/productos/CJATN42");
    expect(body).toMatchObject({ vigencia: "activo", bulto: { codigo: "CJATN42-6", precio: 37_700 } });
  });

  it("arma combos de 4 a 6 bultos entre $ 45.000 y $ 60.000 con los SKUs forzados", async () => {
    const { body } = await call<CatalogoCombosResultado>("/catalogo/combos?modo=margen&forzar=CJATN14");
    expect(body.combos.length).toBeGreaterThan(0);
    for (const combo of body.combos) {
      expect(combo.bultos).toBeGreaterThanOrEqual(4);
      expect(combo.bultos).toBeLessThanOrEqual(6);
      expect(combo.total).toBeGreaterThanOrEqual(45_000);
      expect(combo.total).toBeLessThanOrEqual(60_000);
      expect(combo.total % 500).toBe(0);
      expect(combo.items.some((item) => item.sku === "CJATN14")).toBe(true);
    }
  });
});
