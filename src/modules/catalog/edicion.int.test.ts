import { del } from "@vercel/blob";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { CatalogoAltaInput } from "@/lib/api/contracts/catalogo";
import { ConflictError, ExternalServiceError } from "@/lib/errors";
import { getAuth } from "@/modules/platform/auth/auth";
import { editarProductoDelCatalogo, hacerElCorteDelCatalogo, volverAtrasElCorte } from "./actions";
import { guardarReferencias } from "./alta-consultas";
import { fichaDelProducto } from "./consultas";
import { deshacerElCorte, estadoDelCorte, marcarElCorte } from "./corte";
import { agregarAlCatalogo, datosDeLaEdicion, editarProducto, type CambiosDeLaFicha } from "./edicion";
import { FILA_DE_LA_APP } from "./fila-de-la-app";
import { armarDesdeLasCopias } from "./importar";

const tienda = vi.hoisted(() => ({
  buscar: vi.fn(),
  descripcion: vi.fn(),
  variante: vi.fn(),
  foto: vi.fn(),
  escrituraFalla: null as Error | null,
}));
const request = vi.hoisted(() => ({ headers: new Headers() }));
const workflow = vi.hoisted(() => ({ start: vi.fn() }));

vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("workflow/api", () => workflow);
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));
vi.mock("@/integrations/tiendanube", () => ({
  tiendaNube: async () => ({ buscarPorSku: tienda.buscar }),
  tiendaNubeEscritura: async () => {
    if (tienda.escrituraFalla) throw tienda.escrituraFalla;
    return { actualizarDescripcion: tienda.descripcion, actualizarVariante: tienda.variante, agregarFoto: tienda.foto };
  },
}));

const db = getDb();
const sufijo = Date.now();
const PASSWORD = "contraseña del usuario de prueba";
const MEDIA = "https://abc.public.blob.vercel-storage.com";

const itemDeDux = (code: string, cambios: Record<string, unknown> = {}) => ({
  id: newId(),
  code,
  normalizedCode: code,
  kind: code.includes("-") ? ("pack" as const) : ("prenda" as const),
  baseCode: code.split("-")[0]!,
  packQuantity: code.includes("-") ? Number(code.split("-")[1]) : null,
  name: `${code} en DUX`,
  category: "LESS",
  subcategory: "TALLES NORMALES",
  brand: "UOMO",
  costCents: 100_000n,
  prices: [{ listId: 71695, list: "MAYORISTA EF/TR", cents: 3_000_000 }],
  stockReal: "10",
  stockReserved: "0",
  stockAvailable: "10",
  enabled: true,
  createdOn: new Date("2025-01-15T00:00:00Z"),
  contentHash: code,
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  changedAt: new Date(),
  ...cambios,
});

const FILA_DEL_SHEET = {
  SKU: "LN1",
  "Nombre de DUX": "LESS ALGODON",
  marca_comercial: "UOMO",
  Proveedor: "BETHY",
  tela: "ALGODON",
  curva_colores: "NEGRO",
  curva_talles: "M A XL",
  categoria_tn: "LESS",
  subcategoria_tn: "TALLES NORMALES",
  largo: "25",
  ancho: "15",
  alto: "10",
  peso: "0.25",
};

const CAMBIOS: CambiosDeLaFicha = {
  tela: "MICROFIBRA",
  colores: "ROJO, AZUL",
  talles: "S A L",
  atributos: { encaje: "SI" },
  pesoKg: 0.5,
  medidasCm: [30, 20, 12],
  fotos: [],
};

const foto = (nombre: string) => ({ clave: `catalogo/${nombre}`, nombre, ancho: 800, alto: 800 });

const conCatalogo = async () => {
  await db.duxItem.createMany({ data: [itemDeDux("LN1"), itemDeDux("LN1-6"), itemDeDux("LN2"), itemDeDux("LN2-6")] });
  await db.catalogSheetRow.create({
    data: { id: newId(), rowNumber: 2, shown: FILA_DEL_SHEET, raw: FILA_DEL_SHEET, readAt: new Date() },
  });
  await armarDesdeLasCopias(new Date());
};

const producto = (baseCode: string) =>
  db.catalogProduct.findUniqueOrThrow({ where: { baseCode }, include: { photos: { orderBy: { position: "asc" } } } });

const EN_LA_TIENDA = {
  id: 77,
  published: true,
  categories: [],
  images: [{ id: 1 }],
  variants: [{ id: 9, sku: "LN1-6", price: "100" }],
};

const limpiar = async () => {
  await db.catalogDraft.deleteMany();
  await db.catalogProduct.deleteMany();
  await db.catalogSheetRow.deleteMany();
  await db.catalogDriveFile.deleteMany();
  await db.catalogDecision.deleteMany();
  await db.duxReference.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncLock.deleteMany();
  await db.auditLog.deleteMany({ where: { action: { startsWith: "catalogo." } } });
};

let compras = new Headers();
let marketing = new Headers();
let admin = new Headers();

beforeAll(async () => {
  const entrar = async (rol: "compras" | "marketing" | "admin") => {
    const email = `${rol}+edit${sufijo}@vx3.test`;
    await getAuth().api.createUser({
      body: { email, name: `Prueba ${rol}`, password: PASSWORD, role: rol, data: { mustChangePassword: false } },
    });
    const { headers } = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    const cookie = /((?:__Secure-)?vx3\.session_token=[^;]+)/.exec(headers.get("set-cookie") ?? "")?.[1];
    if (!cookie) throw new Error("No vino la cookie de sesión");
    return new Headers({ cookie });
  };
  compras = await entrar("compras");
  marketing = await entrar("marketing");
  admin = await entrar("admin");
});

beforeEach(async () => {
  await limpiar();
  for (const mock of [tienda.buscar, tienda.descripcion, tienda.variante, tienda.foto]) mock.mockReset();
  tienda.buscar.mockResolvedValue(EN_LA_TIENDA);
  tienda.escrituraFalla = null;
  workflow.start.mockReset().mockResolvedValue({ runId: "wrun_01" });
  vi.mocked(del).mockClear();
  request.headers = compras;
  vi.stubEnv("MEDIA_URL", MEDIA);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_abc_secreto");
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("TIENDANUBE_STORE_ID", "1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.user.deleteMany({ where: { email: { endsWith: `+edit${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

describe("antes del corte", () => {
  it("no se edita: se pisaría con la próxima importación", async () => {
    await conCatalogo();

    await expect(editarProducto("LN1", CAMBIOS)).rejects.toThrow("Antes del corte, el producto se edita en el Sheet");

    expect((await producto("LN1")).fabric).toBe("ALGODON");
    expect(tienda.descripcion).not.toHaveBeenCalled();
  });

  it("la pantalla lo sabe", async () => {
    await conCatalogo();

    expect((await datosDeLaEdicion("LN1"))?.cortado).toBe(false);
  });
});

describe("después del corte", () => {
  beforeEach(async () => {
    await conCatalogo();
    await marcarElCorte("Prueba");
  });

  it("guarda la ficha y el catálogo la muestra", async () => {
    await editarProducto("LN1", CAMBIOS);

    expect(await producto("LN1")).toMatchObject({ fabric: "MICROFIBRA", colors: "ROJO, AZUL", sizes: "S A L" });
    const { weightKg, lengthCm, attributes } = await producto("LN1");
    expect(Number(weightKg)).toBe(0.5);
    expect(Number(lengthCm)).toBe(30);
    expect(attributes).toMatchObject({ encaje: "SI" });
  });

  it("lo que no se edita sigue viniendo de DUX: el nombre y el rubro no se tocan", async () => {
    const { name } = await producto("LN1");

    await editarProducto("LN1", CAMBIOS);

    expect((await producto("LN1")).name).toBe(name);
    await db.duxItem.updateMany({ where: { baseCode: "LN1" }, data: { name: "LN1 NUEVO EN DUX - MEDIA DOCENA" } });
    await armarDesdeLasCopias(new Date());
    expect((await producto("LN1")).name).toContain("NUEVO EN DUX");
  });

  it("un producto que estaba solo en DUX estrena su ficha", async () => {
    expect((await producto("LN2")).inSheet).toBe(false);

    await editarProducto("LN2", CAMBIOS);

    expect(await producto("LN2")).toMatchObject({ fabric: "MICROFIBRA", inSheet: true, sheetRow: null });
    const fila = await db.catalogSheetRow.findFirstOrThrow({ where: { source: "app" } });
    expect(fila.rowNumber).toBeGreaterThan(FILA_DE_LA_APP);
  });

  it("un producto que no está lo dice", async () => {
    await expect(editarProducto("NOEXISTE", CAMBIOS)).rejects.toThrow("Ese producto ya no está");
  });

  describe("las fotos", () => {
    it("se suman, en orden, y el catálogo las muestra", async () => {
      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg"), foto("b.jpg")] });

      const { photos } = await producto("LN1");
      expect(photos.map(({ storageKey, position }) => [storageKey, position])).toEqual([
        ["catalogo/a.jpg", 0],
        ["catalogo/b.jpg", 1],
      ]);
    });

    it("reordenar cambia el orden, sin borrar nada del store", async () => {
      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg"), foto("b.jpg")] });

      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("b.jpg"), foto("a.jpg")] });

      const { photos } = await producto("LN1");
      expect(photos.map(({ storageKey }) => storageKey)).toEqual(["catalogo/b.jpg", "catalogo/a.jpg"]);
      expect(del).not.toHaveBeenCalled();
    });

    it("quitar una la saca del catálogo y del store", async () => {
      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg"), foto("b.jpg")] });

      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("b.jpg")] });

      expect((await producto("LN1")).photos.map(({ storageKey }) => storageKey)).toEqual(["catalogo/b.jpg"]);
      expect(del).toHaveBeenCalledExactlyOnceWith([`${MEDIA}/catalogo/a.jpg`], expect.anything());
    });

    it("las de Drive quedan primero, y como están", async () => {
      await db.catalogDriveFile.create({
        data: {
          id: newId(),
          driveId: "en-drive",
          name: "LN1.jpg",
          mimeType: "image/jpeg",
          folder: "Repositorio Fotos",
          readAt: new Date(),
        },
      });
      await armarDesdeLasCopias(new Date());

      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg")] });

      const { photos } = await producto("LN1");
      expect(photos.map(({ driveId, storageKey }) => driveId ?? storageKey)).toEqual(["en-drive", "catalogo/a.jpg"]);
    });
  });

  describe("la tienda, por SKU", () => {
    it("actualiza descripción, medidas y fotos nuevas", async () => {
      const { aviso } = await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg")] });

      expect(aviso).toBeNull();
      expect(tienda.buscar).toHaveBeenCalledWith("LN1-6");
      expect(tienda.descripcion).toHaveBeenCalledExactlyOnceWith(77, expect.stringContaining("Tela: MICROFIBRA."));
      expect(tienda.variante).toHaveBeenCalledExactlyOnceWith(77, 9, { weight: 0.5, width: 20, height: 12, depth: 30 });
      expect(tienda.foto).toHaveBeenCalledExactlyOnceWith(77, { src: `${MEDIA}/catalogo/a.jpg`, position: 2 });
    });

    it("una foto que ya está no se vuelve a mandar", async () => {
      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg")] });
      tienda.foto.mockClear();

      await editarProducto("LN1", { ...CAMBIOS, tela: "OTRA", fotos: [foto("a.jpg"), foto("b.jpg")] });

      expect(tienda.foto).toHaveBeenCalledExactlyOnceWith(
        77,
        expect.objectContaining({ src: `${MEDIA}/catalogo/b.jpg` }),
      );
    });

    it("si la tienda falla, en la app queda guardado, lo dice, y guardar de nuevo lo reintenta", async () => {
      tienda.foto.mockRejectedValueOnce(new ExternalServiceError("Tienda Nube", "Tienda Nube no respondió."));

      const { aviso } = await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg")] });

      expect(aviso).toContain("En la app quedó guardado, pero la tienda no: Tienda Nube no respondió.");
      expect((await producto("LN1")).fabric).toBe("MICROFIBRA");

      await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg")] });
      expect(tienda.foto).toHaveBeenCalledTimes(2);
    });

    it("si no está en la tienda, no crea nada: lo dice", async () => {
      tienda.buscar.mockResolvedValue(null);

      const { aviso } = await editarProducto("LN1", CAMBIOS);

      expect(aviso).toContain("LN1-6 no está en la tienda");
      expect(tienda.descripcion).not.toHaveBeenCalled();
    });

    it("fuera de producción no se escribe: guarda en la app y lo dice", async () => {
      vi.stubEnv("APP_ENV", "qa");

      const { aviso } = await editarProducto("LN1", CAMBIOS);

      expect(aviso).toContain("Fuera de producción no se escribe en Tienda Nube");
      expect(tienda.descripcion).not.toHaveBeenCalled();
      expect((await producto("LN1")).fabric).toBe("MICROFIBRA");
    });

    it("si el cliente de escritura lo frena igual, lo dice como aviso", async () => {
      tienda.escrituraFalla = new ConflictError("Fuera de producción.");

      expect((await editarProducto("LN1", CAMBIOS)).aviso).toContain("Fuera de producción.");
    });
  });

  it("muestra lo que ya tiene, y queda el dato en la pantalla de edición", async () => {
    await editarProducto("LN1", { ...CAMBIOS, fotos: [foto("a.jpg")] });

    expect(await datosDeLaEdicion("LN1")).toMatchObject({
      cortado: true,
      tela: "MICROFIBRA",
      colores: "ROJO, AZUL",
      pesoKg: 0.5,
      medidasCm: [30, 20, 12],
      fotos: [{ clave: "catalogo/a.jpg" }],
      fotosDeDrive: 0,
    });
  });

  it("la ficha ofrece editar, y dice que lo que falta se corrige ahí", async () => {
    const respuesta = await fichaDelProducto("LN1");

    expect(respuesta?.editable).toBe(true);
    await deshacerElCorte();
    expect((await fichaDelProducto("LN1"))?.editable).toBe(false);
  });

  it("no pisa una importación en curso", async () => {
    await db.syncLock.create({
      data: { integration: "google", holder: newId(), expiresAt: new Date(Date.now() + 60_000) },
    });

    await expect(editarProducto("LN1", CAMBIOS)).rejects.toThrow("Se está armando el catálogo");
  });

  it("volver atrás: la fila de la app sigue, y se vuelve a poder leer el Sheet", async () => {
    await editarProducto("LN1", CAMBIOS);

    await deshacerElCorte();

    expect(await estadoDelCorte()).toBeNull();
    await expect(editarProducto("LN1", CAMBIOS)).rejects.toThrow("Antes del corte");
  });
});

describe("el alta entra al catálogo", () => {
  const ALTA = {
    sku: "ZZ1",
    rubro: "LESS",
    subrubro: "TALLES NORMALES",
    nombre: "LESS NUEVO - CURVA DE TALLES M A XL - NEGRO",
    prenda: "LESS NUEVO",
    color: "NEGRO",
    copa: "B",
    marca: "UOMO",
    proveedorId: "7",
    tela: "ENCAJE",
    colores: ["NEGRO", "BLANCO"],
    talles: "M A XL",
    atributos: { encaje: "SI" },
    opcionales: {},
    costoDocena: 48_000,
    pesoBultoKg: 0.7,
    medidasCm: [32, 18, 9],
    fotos: [foto("zz.jpg")],
  } satisfies CatalogoAltaInput;

  beforeEach(async () => {
    await guardarReferencias(
      {
        rubros: [],
        subrubros: [],
        proveedores: [{ id: 7, nombre: "BETHY", habilitado: true }],
        listas: [],
      },
      new Date(),
    );
    await agregarAlCatalogo(ALTA);
  });

  it("con su ficha y su foto, cuando DUX ya lo trajo", async () => {
    await db.duxItem.createMany({ data: [itemDeDux("ZZ1"), itemDeDux("ZZ1-6")] });

    await armarDesdeLasCopias(new Date());

    expect(await producto("ZZ1")).toMatchObject({
      fabric: "ENCAJE",
      colors: "NEGRO, BLANCO",
      brand: "UOMO",
      inSheet: true,
      inDux: true,
      sheetRow: null,
      bulkCode: "ZZ1-6",
      photos: [{ storageKey: "catalogo/zz.jpg", position: 0 }],
    });
  });

  it("si se repite, no duplica la fila", async () => {
    await agregarAlCatalogo(ALTA);

    expect(await db.catalogSheetRow.count({ where: { source: "app" } })).toBe(1);
  });

  it("antes del corte, otra importación no la pisa", async () => {
    await db.duxItem.createMany({ data: [itemDeDux("ZZ1"), itemDeDux("ZZ1-6")] });

    await armarDesdeLasCopias(new Date());
    await armarDesdeLasCopias(new Date());

    expect((await producto("ZZ1")).fabric).toBe("ENCAJE");
  });
});

describe("los permisos", () => {
  const prohibido = { ok: false, error: { code: "FORBIDDEN" } };
  const ENTRADA = { sku: "LN1", ...CAMBIOS };

  it("un rol que solo ve el catálogo no edita", async () => {
    request.headers = marketing;

    expect(await editarProductoDelCatalogo(ENTRADA)).toMatchObject(prohibido);
  });

  it("editar queda registrado", async () => {
    await conCatalogo();
    await marcarElCorte("Prueba");

    expect(await editarProductoDelCatalogo(ENTRADA)).toMatchObject({ ok: true });

    expect(await db.auditLog.findFirstOrThrow({ where: { action: "catalogo.edito" } })).toMatchObject({
      entityId: "LN1",
    });
  });

  it("una foto fuera de la carpeta del catálogo no entra", async () => {
    expect(
      await editarProductoDelCatalogo({ ...ENTRADA, fotos: [{ ...foto("x.jpg"), clave: "otra/x.jpg" }] }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it.each([
    ["compras", () => compras],
    ["marketing", () => marketing],
  ])("%s no hace el corte ni lo deshace: es solo de admin", async (_, sesion) => {
    request.headers = sesion();

    expect(await hacerElCorteDelCatalogo({})).toMatchObject(prohibido);
    expect(await volverAtrasElCorte({})).toMatchObject(prohibido);
    expect(workflow.start).not.toHaveBeenCalled();
  });

  it("admin lo lanza, y queda registrado", async () => {
    request.headers = admin;

    expect(await hacerElCorteDelCatalogo({})).toMatchObject({ ok: true, data: { runId: "wrun_01" } });

    expect(workflow.start).toHaveBeenCalledOnce();
    expect((workflow.start.mock.calls[0]?.[1] as unknown[])[2]).toBe(true);
    expect(await db.auditLog.count({ where: { action: "catalogo.corte" } })).toBe(1);
  });

  it("no se hace dos veces, y no se deshace lo que no está hecho", async () => {
    request.headers = admin;
    const conflicto = { ok: false, error: { code: "CONFLICT" } };

    expect(await volverAtrasElCorte({})).toMatchObject(conflicto);

    await marcarElCorte("Prueba");
    expect(await hacerElCorteDelCatalogo({})).toMatchObject(conflicto);
    expect(await volverAtrasElCorte({})).toMatchObject({ ok: true });
    expect(await estadoDelCorte()).toBeNull();
  });

  it("con una importación en curso, no arranca otra", async () => {
    request.headers = admin;
    await db.syncLock.create({
      data: { integration: "google", holder: newId(), expiresAt: new Date(Date.now() + 60_000) },
    });

    expect(await hacerElCorteDelCatalogo({})).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(workflow.start).not.toHaveBeenCalled();
  });
});
