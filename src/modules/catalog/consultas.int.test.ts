import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { CatalogoControl, CatalogoFacetas, CatalogoFicha, CatalogoFila } from "@/lib/api/contracts/catalogo";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import type { Kpi, Paginated } from "@/lib/api/types";
import { listarProductos } from "./consultas";
import type { Faltante } from "./salud";

const db = getDb();
const ADMIN = { role: "admin" } as const;

const pedir = async <T>(ruta: string, user: { role: "admin" | "solo_lectura" } = ADMIN) => {
  const respuesta = await dispatchApiRequest(new Request(`http://app.local/api/v1${ruta}`), {
    user,
    realDomains: ["catalogo"],
  });
  return { status: respuesta.status, cuerpo: (await respuesta.json()) as T };
};

const precios = (mayorista: number, local = mayorista) => [
  { listId: 1, list: "MAYORISTA EF/TR", cents: mayorista },
  { listId: 2, list: "LOCAL EF/TR", cents: local },
  { listId: 3, list: "VACIA", cents: 0 },
];

const itemDeDux = (code: string, cambios: Record<string, unknown> = {}) => ({
  id: newId(),
  code,
  normalizedCode: code,
  kind: code.includes("-") ? ("pack" as const) : ("prenda" as const),
  baseCode: code.split("-")[0]!,
  packQuantity: code.includes("-") ? Number(code.split("-")[1]) : null,
  name: `${code} - UNIDAD`,
  category: "LESS",
  costCents: 500_000n,
  prices: precios(0),
  stockReal: "0",
  stockReserved: "0",
  stockAvailable: "0",
  enabled: true,
  createdOn: new Date("2025-01-15T00:00:00Z"),
  contentHash: code,
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  changedAt: new Date(),
  ...cambios,
});

let filaDelSheet = 1;

async function producto(
  baseCode: string,
  {
    fotos = [],
    presentaciones = [],
    missing = [],
    ...cambios
  }: {
    fotos?: string[];
    presentaciones?: { code: string; kind?: "prenda" | "pack" | "combo"; quantity?: number | null }[];
    missing?: Faltante[];
    [columna: string]: unknown;
  } = {},
) {
  filaDelSheet += 1;
  const id = newId();
  await db.catalogProduct.create({
    data: {
      id,
      baseCode,
      name: `Producto ${baseCode}`,
      isCombo: false,
      category: "LESS",
      subcategory: "TALLES NORMALES",
      brand: "Linda Luna",
      lastSupplier: "BETHY",
      fabric: "ALGODON",
      colors: "NEGRO, BLANCO",
      sizes: "M A XL",
      attributes: { encaje: "SI" },
      lifecycle: "activo",
      seasonal: false,
      priority: "C",
      sales90dCents: 0n,
      missing,
      readyToSell: missing.length === 0,
      inSheet: true,
      inDux: true,
      sheetRow: filaDelSheet,
      searchText: `${baseCode.toLowerCase()} producto`,
      contentHash: baseCode,
      firstSeenAt: new Date(),
      changedAt: new Date(),
      ...cambios,
    },
  });
  if (presentaciones.length > 0) {
    await db.catalogPresentation.createMany({
      data: presentaciones.map(({ code, kind = "pack", quantity = null }) => ({
        id: newId(),
        productId: id,
        code,
        kind,
        quantity,
        inDux: true,
      })),
    });
  }
  if (fotos.length > 0) {
    await db.catalogPhoto.createMany({
      data: fotos.map((driveId, position) => ({
        id: newId(),
        productId: id,
        driveId,
        name: `${driveId}.jpg`,
        position,
      })),
    });
  }
}

const limpiar = async () => {
  // La branch de prueba es una copia de develop, que ya tiene la tienda leída.
  await db.storeProduct.deleteMany();
  await db.syncRun.deleteMany({ where: { integration: "tiendanube" } });
  await db.catalogProduct.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
};

beforeEach(limpiar);

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("los indicadores", () => {
  it("cuentan por estado, y las tres fuentes", async () => {
    await producto("LN1", { fotos: ["a"] });
    await producto("LN2", { missing: [{ dato: "foto", situacion: "falta" }] });
    await producto("LN3", { lifecycle: "agotado", seasonal: true });
    await producto("LN4", { lifecycle: "historico" });
    await producto("LN5", { present: false });

    const { cuerpo } = await pedir<Kpi[]>("/catalogo/kpis");

    expect(cuerpo).toMatchObject([
      { id: "productos", value: 4, hint: "1 en el Sheet, Drive y DUX" },
      { id: "activos", value: 2, hint: "1 listos para vender" },
      { id: "agotados", value: 1, hint: "1 de temporada" },
      { id: "historicos", value: 1 },
    ]);
  });
});

describe("la lista", () => {
  const lista = async (query = "") => (await pedir<Paginated<CatalogoFila>>(`/catalogo/productos${query}`)).cuerpo;

  it("muestra lo que hay en la base, con los más vendidos primero", async () => {
    await producto("LN1");
    await producto("LN2", { salesRank: 2, priority: "A" });
    await producto("LN3", { salesRank: 1, priority: "A" });

    const { data, total } = await lista();

    expect(total).toBe(3);
    expect(data.map(({ sku }) => sku)).toEqual(["LN3", "LN2", "LN1"]);
  });

  it("lee precio y stock del espejo de DUX: el bulto del rubro, en bultos completos", async () => {
    await db.duxItem.createMany({
      data: [
        itemDeDux("LN1", { stockAvailable: "20" }),
        itemDeDux("LN1-6", { prices: precios(1_500_000), stockAvailable: "3.33333333" }),
      ],
    });
    await producto("LN1", { bulkCode: "LN1-6" });

    const { data } = await lista();

    expect(data[0]).toMatchObject({
      bulto: { codigo: "LN1-6", label: "Media docena", precio: 15_000 },
      bultosDisponibles: 3,
    });
  });

  it("un combo mira su propio stock", async () => {
    await db.duxItem.create({
      data: itemDeDux("COMBO7", { kind: "combo", baseCode: "COMBO7", prices: precios(4_160_000), stockAvailable: "5" }),
    });
    await producto("COMBO7", { isCombo: true, bulkCode: "COMBO7", category: "COMBOS" });

    expect((await lista()).data[0]).toMatchObject({
      bulto: { codigo: "COMBO7", label: "Combo", precio: 41_600 },
      bultosDisponibles: 5,
    });
  });

  it("el stock negativo no es disponible", async () => {
    await db.duxItem.createMany({
      data: [itemDeDux("LN1", { stockAvailable: "-4" }), itemDeDux("LN1-6")],
    });
    await producto("LN1", { bulkCode: "LN1-6" });

    expect((await lista()).data[0]?.bultosDisponibles).toBe(0);
  });

  it("la foto es la primera de Drive; si no hay, la de DUX; si no, ninguna", async () => {
    await db.duxItem.create({ data: itemDeDux("LN2", { imageUrl: "https://dux.example/ln2.jpg" }) });
    await producto("LN1", { fotos: ["primera", "segunda"], salesRank: 1 });
    await producto("LN2", { salesRank: 2 });
    await producto("LN3", { salesRank: 3 });

    const { data } = await lista();

    expect(data.map(({ foto }) => foto)).toEqual([
      "https://drive.google.com/thumbnail?id=primera&sz=w400",
      "https://dux.example/ln2.jpg",
      null,
    ]);
  });

  it("un filtro por rubro y estado devuelve lo mismo que la base", async () => {
    await producto("LN1", { category: "LESS", lifecycle: "agotado" });
    await producto("LN2", { category: "LESS" });
    await producto("LN3", { category: "CORPIÑOS", lifecycle: "agotado" });

    const { data, total } = await lista("?rubro=less&estado=agotado");

    expect(total).toBe(1);
    expect(data.map(({ sku }) => sku)).toEqual(["LN1"]);
  });

  it("sin filtros no trae los históricos, y buscándolos sí", async () => {
    await producto("LN1", { lifecycle: "historico" });

    expect((await lista()).total).toBe(0);
    expect((await lista("?q=ln1")).total).toBe(1);
    expect((await lista("?estado=historico")).total).toBe(1);
  });

  it("no trae lo que dejó de existir", async () => {
    await producto("LN1", { present: false });

    expect((await lista("?q=ln1")).total).toBe(0);
  });

  it("pagina, y una página fuera de rango va a la última", async () => {
    for (const codigo of ["LN1", "LN2", "LN3"]) await producto(codigo);

    expect(await lista("?pageSize=2&page=2")).toMatchObject({
      page: 2,
      totalPages: 2,
      total: 3,
      data: [{ sku: "LN3" }],
    });
    expect(await lista("?pageSize=2&page=9")).toMatchObject({ page: 2 });
    expect((await listarProductos({})).pageSize).toBe(24);
  });
});

describe("las facetas", () => {
  it("cuentan lo que hay, con los filtros aplicados", async () => {
    await producto("LN1", { category: "LESS", subcategory: "NORMAL" });
    await producto("LN2", { category: "LESS", subcategory: "GRANDE" });
    await producto("LN3", { category: "CORPIÑOS", subcategory: "ARMADO" });

    const { cuerpo } = await pedir<CatalogoFacetas>("/catalogo/facetas?rubro=less");

    expect(cuerpo.subrubros.map(({ etiqueta }) => etiqueta)).toEqual(["GRANDE", "NORMAL"]);
    expect(cuerpo.rubros).toContainEqual({ valor: "less", etiqueta: "LESS", productos: 2 });
  });
});

describe("la ficha", () => {
  const ficha = async (sku: string) => pedir<CatalogoFicha>(`/catalogo/productos/${encodeURIComponent(sku)}`);

  it("muestra sus presentaciones, sus fotos y lo que le falta", async () => {
    await db.duxItem.createMany({
      data: [
        itemDeDux("MSU2-1", {
          baseCode: "MSU2-1",
          packQuantity: null,
          stockAvailable: "40",
          prices: precios(0, 200_000),
        }),
        itemDeDux("MSU2-1-12", {
          baseCode: "MSU2-1",
          packQuantity: 12,
          stockAvailable: "3.33333333",
          prices: precios(1_500_000),
        }),
      ],
    });
    await producto("MSU2-1", {
      category: "MEDIAS",
      bulkCode: "MSU2-1-12",
      sheetRow: 57,
      salesRank: 3,
      priority: "A",
      lastSaleOn: new Date("2026-10-01T00:00:00Z"),
      lengthCm: 25,
      widthCm: 15,
      heightCm: 10,
      weightKg: 0.25,
      presentaciones: [
        { code: "MSU2-1-12", quantity: 12 },
        { code: "MSU2-1", kind: "prenda" },
      ],
      fotos: ["uno", "dos"],
      missing: [
        { dato: "precio", situacion: "falta" },
        { dato: "tela", situacion: "no_hay_dato" },
      ],
    });

    const { status, cuerpo } = await ficha("MSU2-1");

    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({
      sku: "MSU2-1",
      prioridad: "A",
      ranking: 3,
      ultimaVenta: "2026-10-01",
      filaDelSheet: 57,
      medidasCm: [25, 15, 10],
      pesoKg: 0.25,
      atributos: [{ label: "Encaje", valor: "SI" }],
      bultosDisponibles: 3,
      presentaciones: [
        {
          codigo: "MSU2-1",
          label: "Unidad",
          prendas: null,
          precio: 2_000,
          listas: ["LOCAL EF/TR"],
          esBulto: false,
          disponible: 40,
        },
        {
          codigo: "MSU2-1-12",
          label: "Una docena",
          prendas: 12,
          precio: 15_000,
          listas: ["MAYORISTA EF/TR", "LOCAL EF/TR"],
          esBulto: true,
          disponible: 3,
        },
      ],
      fotos: [
        {
          id: "uno",
          miniatura: "https://drive.google.com/thumbnail?id=uno&sz=w800",
          original: "https://drive.google.com/file/d/uno/view",
        },
        { id: "dos" },
      ],
      faltantes: [
        { dato: "Precio del bulto", situacion: "falta", bloquea: true, seCorrigeEn: "DUX" },
        { dato: "Tela", situacion: "no_hay_dato", bloquea: false, seCorrigeEn: "Sheet, fila 57" },
      ],
    });
  });

  it("no lleva costos: no hacen falta para consultar el catálogo", async () => {
    await db.duxItem.create({ data: itemDeDux("LN1") });
    await producto("LN1", { presentaciones: [{ code: "LN1", kind: "prenda" }] });

    expect(JSON.stringify((await ficha("LN1")).cuerpo)).not.toMatch(/costo|cost/i);
  });

  it("encuentra el producto aunque el código venga con espacios", async () => {
    await producto("LN25");

    expect((await ficha("LN 25")).cuerpo.sku).toBe("LN25");
  });

  it("si no existe, o dejó de existir, responde 404", async () => {
    await producto("LN1", { present: false });

    expect((await ficha("LN1")).status).toBe(404);
    expect((await ficha("NOEXISTE1")).status).toBe(404);
  });
});

describe("las fotos subidas en la app", () => {
  const MEDIA = "https://abc.public.blob.vercel-storage.com";
  const subida = async (baseCode: string, position: number, storageKey: string) => {
    const { id } = await db.catalogProduct.findUniqueOrThrow({ where: { baseCode } });
    await db.catalogPhoto.create({
      data: { id: newId(), productId: id, storageKey, name: "subida.jpg", position, width: 800, height: 600 },
    });
  };

  beforeEach(() => {
    vi.stubEnv("MEDIA_URL", MEDIA);
  });

  it("la lista muestra la principal igual, venga de Drive o del store", async () => {
    await producto("LN1", { fotos: ["en-drive"] });
    await producto("LN2");
    await subida("LN2", 0, "catalogo/nueva.jpg");

    const { data } = await listarProductos({});

    expect(data.find(({ sku }) => sku === "LN1")?.foto).toContain("en-drive");
    expect(data.find(({ sku }) => sku === "LN2")?.foto).toBe(`${MEDIA}/catalogo/nueva.jpg`);
  });

  it("la ficha las muestra en orden, con su original", async () => {
    await producto("LN1", { fotos: ["en-drive"] });
    await subida("LN1", 1, "catalogo/nueva.jpg");

    const {
      cuerpo: { fotos, foto },
    } = await pedir<CatalogoFicha>("/catalogo/productos/LN1");

    expect(foto).toContain("en-drive");
    expect(fotos).toMatchObject([
      { nombre: "en-drive.jpg", original: "https://drive.google.com/file/d/en-drive/view" },
      {
        nombre: "subida.jpg",
        miniatura: `${MEDIA}/catalogo/nueva.jpg`,
        original: `${MEDIA}/catalogo/nueva.jpg`,
        ancho: 800,
        alto: 600,
      },
    ]);
  });

  it("sin store en este ambiente, una subida no se muestra rota", async () => {
    vi.stubEnv("MEDIA_URL", "");
    await producto("LN1");
    await subida("LN1", 0, "catalogo/nueva.jpg");

    const {
      cuerpo: { fotos, foto },
    } = await pedir<CatalogoFicha>("/catalogo/productos/LN1");

    expect(fotos).toEqual([]);
    expect(foto).toBeNull();
  });

  it("una foto tiene un solo origen", async () => {
    await producto("LN1");
    const { id: productId } = await db.catalogProduct.findUniqueOrThrow({ where: { baseCode: "LN1" } });

    const fila = { id: newId(), productId, name: "x", position: 0 };
    await expect(db.catalogPhoto.create({ data: fila })).rejects.toThrow();
    await expect(
      db.catalogPhoto.create({ data: { ...fila, driveId: "uno", storageKey: "catalogo/dos.jpg" } }),
    ).rejects.toThrow();
  });
});

describe("el control final", () => {
  const control = async () => {
    const { status, cuerpo } = await pedir<CatalogoControl[]>("/catalogo/control");
    expect(status).toBe(200);
    return Object.fromEntries(cuerpo.map((chequeo) => [chequeo.id, chequeo]));
  };
  const enLaTienda = (sku: string, cambios: Record<string, unknown> = {}) =>
    db.storeProduct.create({
      data: {
        id: BigInt(sku.length + Math.floor(Math.random() * 1_000_000)),
        sku,
        name: sku,
        published: true,
        section: "MUJER",
        categoryIds: [],
        imageCount: 1,
        priceCents: 100n,
        readAt: new Date(),
        ...cambios,
      },
    });
  const seLeyo = () =>
    db.syncRun.create({
      data: {
        id: newId(),
        integration: "tiendanube",
        operation: "lectura",
        status: "ok",
        trigger: "cron",
        startedAt: new Date(),
        finishedAt: new Date(),
        calls: 1,
        records: 1,
      },
    });

  afterEach(async () => {
    await db.storeProduct.deleteMany();
    await db.syncRun.deleteMany({ where: { integration: "tiendanube" } });
  });

  it("sale de lo que ya se leyó, y marca lo que está mal", async () => {
    await db.duxItem.createMany({
      data: [
        itemDeDux("LN1", { baseCode: "LN1" }),
        itemDeDux("LN1-6", { baseCode: "LN1", packQuantity: 6, kind: "pack" }),
      ],
    });
    await producto("LN1", { bulkCode: "LN1-6", fotos: [] });
    await seLeyo();
    await enLaTienda("OTRO-6", { section: null });

    const { precio, foto, secciones, "tienda-bulto": bulto, "tienda-falta": falta } = await control();

    expect(precio?.fallas[0]).toMatchObject({ sku: "LN1", detalle: "LN1-6 no tiene precio." });
    expect(foto?.fallas[0]).toMatchObject({ sku: "LN1" });
    expect(bulto?.fallas[0]).toMatchObject({ sku: "OTRO-6" });
    expect(falta?.fallas[0]).toMatchObject({ detalle: "LN1-6 no está en la tienda." });
    expect(secciones?.fallas).toHaveLength(1);
  });

  it("sin haber leído la tienda, no marca como faltante todo lo activo", async () => {
    await db.duxItem.create({ data: itemDeDux("LN1-6", { baseCode: "LN1", packQuantity: 6, kind: "pack" }) });
    await producto("LN1", { bulkCode: "LN1-6" });

    const { "tienda-falta": falta } = await control();

    expect(falta).toMatchObject({ fallas: [], aviso: expect.stringContaining("Todavía no se leyó") });
  });

  it("los históricos no se revisan", async () => {
    await producto("LN1", { bulkCode: null, lifecycle: "historico", fotos: [] });

    const { precio, foto } = await control();

    expect(precio?.revisados).toBe(0);
    expect(foto?.revisados).toBe(0);
  });

  describe("en la ficha", () => {
    const estado = async () => (await pedir<CatalogoFicha>("/catalogo/productos/LN1")).cuerpo.enLaTienda;

    beforeEach(async () => {
      await producto("LN1", { bulkCode: "LN1-6" });
    });

    it("sin haber leído la tienda no se sabe", async () => {
      expect(await estado()).toBeNull();
    });

    it("no está", async () => {
      await seLeyo();

      expect(await estado()).toBe("no_esta");
    });

    it("publicado", async () => {
      await seLeyo();
      await enLaTienda("LN1-6");

      expect(await estado()).toBe("publicado");
    });

    it("pausado", async () => {
      await seLeyo();
      await enLaTienda("LN1-6", { published: false });

      expect(await estado()).toBe("pausado");
    });
  });
});

describe("los permisos y lo que sigue simulado", () => {
  it("un rol sin el área de productos no entra", async () => {
    expect((await pedir("/catalogo/kpis", { role: "solo_lectura" })).status).toBe(403);
  });

  it("los combos siguen saliendo de la maqueta", async () => {
    const { status, cuerpo } = await pedir<{ combos: unknown[] }>("/catalogo/combos?modo=margen");

    expect(status).toBe(200);
    expect(cuerpo.combos.length).toBeGreaterThan(0);
  });
});
