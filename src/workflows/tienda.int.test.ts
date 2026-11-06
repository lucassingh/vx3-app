import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { ExternalServiceError } from "@/lib/errors";
import { guardarCredencial } from "@/modules/platform/credentials/service";
import { leerTiendaNube } from "./tienda";

const tienda = vi.hoisted(() => ({ categorias: vi.fn(), productos: vi.fn() }));

vi.mock("@/integrations/tiendanube", () => ({
  tiendaNube: async ({ alIntentar }: { alIntentar?: () => void } = {}) => ({
    listarCategorias: async () => {
      alIntentar?.();
      return tienda.categorias();
    },
    listarProductos: async () => {
      alIntentar?.();
      return tienda.productos();
    },
  }),
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;
const corrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });

const PRODUCTO = {
  id: 1,
  published: true,
  categories: [{ id: 1 }],
  images: [{ id: 1 }],
  variants: [{ sku: "LN1-6", price: "100.00" }],
};
const CATEGORIAS = [{ id: 1, parent: 0, name: { es: "MUJER" }, visibility: "visible" }];

const limpiar = async () => {
  await db.storeProduct.deleteMany();
  await db.syncRun.deleteMany();
  await db.integrationCredential.deleteMany();
};

beforeEach(async () => {
  await limpiar();
  tienda.categorias.mockReset().mockResolvedValue(CATEGORIAS);
  tienda.productos.mockReset().mockResolvedValue([PRODUCTO]);
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

const conToken = () => guardarCredencial("tiendanube", "token-de-tienda-nube", { id: newId(), label: "Prueba" });

describe("leerTiendaNube", () => {
  it("sin el token no hace nada: ese ambiente no está conectado", async () => {
    expect(await leerTiendaNube(ORIGEN)).toEqual({ status: "omitida" });

    expect(tienda.productos).not.toHaveBeenCalled();
    expect(await db.syncRun.count()).toBe(0);
  });

  it("guarda lo que leyó, y registra la corrida", async () => {
    await conToken();

    expect(await leerTiendaNube(ORIGEN)).toEqual({ status: "ok" });

    expect(await db.storeProduct.count()).toBe(1);
    expect(await corrida()).toMatchObject({
      integration: "tiendanube",
      operation: "lectura",
      status: "ok",
      calls: 2,
      detail: "Productos: 1, 1 visibles. Fuera de las secciones: 0.",
    });
  });

  it("si falla, queda la foto anterior, y lo dice", async () => {
    await conToken();
    await leerTiendaNube(ORIGEN);
    tienda.productos.mockRejectedValueOnce(new ExternalServiceError("Tienda Nube", "Tienda Nube no respondió."));

    expect(await leerTiendaNube(ORIGEN)).toEqual({ status: "error" });

    expect(await db.storeProduct.count()).toBe(1);
    expect((await corrida()).detail).toBe("Tienda Nube no respondió. Queda la lectura anterior.");
  });

  it("un error que no es de la tienda no se disimula", async () => {
    await conToken();
    tienda.productos.mockRejectedValueOnce(new Error("Se rompió otra cosa"));

    await expect(leerTiendaNube(ORIGEN)).rejects.toThrow("Se rompió otra cosa");
  });
});
