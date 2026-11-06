import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { ArchivoDeDrive, PestanaDelSheet } from "@/integrations/google/client";
import { ExternalServiceError } from "@/lib/errors";
import { BLOQUEO_DEL_CATALOGO, DECISION_DE_FOTO } from "@/modules/catalog/importar";
import { guardarCredencial } from "@/modules/platform/credentials/service";
import { hayCorridaEnCurso, tomarBloqueo } from "@/modules/platform/sync-runs";
import { deshacerElCorte, estadoDelCorte } from "@/modules/catalog/corte";
import { arrancarElCorte, arrancarImportacionDelCatalogo } from "./arrancar-catalogo";
import { importarCatalogo, importarCatalogoTrasDux, VENCE_IMPORTACION_MS } from "./catalogo";

// Sin el compilador de workflow, "use workflow" y "use step" no hacen nada: acá corre como funciones comunes.
const google = vi.hoisted(() => ({
  planilla: (async () => []) as () => Promise<PestanaDelSheet[]>,
  carpeta: (async () => []) as () => Promise<ArchivoDeDrive[]>,
}));
const workflow = vi.hoisted(() => ({ start: vi.fn() }));

vi.mock("workflow/api", () => workflow);
vi.mock("@/integrations/google", () => ({
  fuentesDelCatalogo: () => ({ sheetId: "sheet", carpetaId: "carpeta" }),
  googleClient: async ({ alIntentar }: { alIntentar?: () => void } = {}) => ({
    leerPlanilla: () => {
      alIntentar?.();
      return google.planilla();
    },
    leerCarpeta: () => {
      alIntentar?.();
      return google.carpeta();
    },
  }),
}));

const db = getDb();
const ORIGEN = { trigger: "manual", triggeredBy: "Prueba" } as const;
const ENCABEZADOS = [
  "SKU",
  "Nombre de DUX",
  "marca_comercial",
  "curva_colores",
  "curva_talles",
  "copa",
  "encaje",
  "push_up",
  "aro",
  "elastico",
  "tipo_bretel",
  "gancho_espalda",
  "tela",
  "otros_detalles",
  "largo",
  "ancho",
  "alto",
  "peso",
  "categoria_tn",
  "subcategoria_tn",
  "Proveedor",
];

type Fila = { sku: string; nombre?: string; tela?: string; sku_nuevo?: string };

function planilla(filas: Fila[], encabezados = ENCABEZADOS): PestanaDelSheet[] {
  const conNuevo = [...encabezados, "sku_nuevo"];
  const valores = (f: Fila) =>
    conNuevo.map((encabezado) => {
      const porColumna: Record<string, string> = {
        SKU: f.sku,
        "Nombre de DUX": f.nombre ?? `Nombre del Sheet de ${f.sku}`,
        marca_comercial: "Linda Luna",
        tela: f.tela ?? "ALGODON",
        largo: "25",
        ancho: "15",
        alto: "10",
        peso: "0.25",
        categoria_tn: "LESS",
        Proveedor: "BETHY",
        sku_nuevo: f.sku_nuevo ?? "",
      };
      return porColumna[encabezado] ?? "";
    });
  return [
    { titulo: "CatalogoDetalle", visto: [conNuevo, ...filas.map(valores)], crudo: [conNuevo, ...filas.map(valores)] },
  ];
}

const archivo = (nombre: string): ArchivoDeDrive => ({
  id: `id-${nombre}`,
  nombre,
  mimeType: "image/jpeg",
  bytes: 1000,
  md5: `md5-${nombre}`,
  creado: null,
  modificado: "2026-11-01T12:00:00.000Z",
  ancho: 1600,
  alto: 1600,
  ruta: "Repositorio Fotos",
});

const conFuentes = (filas: Fila[], ...archivos: string[]) => {
  google.planilla = async () => planilla(filas);
  google.carpeta = async () => archivos.map(archivo);
};

const itemDeDux = (code: string, cambios: Record<string, unknown> = {}) => ({
  id: newId(),
  code,
  normalizedCode: code,
  kind: code.includes("-") ? ("pack" as const) : ("prenda" as const),
  baseCode: code.split("-")[0]!,
  packQuantity: code.includes("-") ? Number(code.split("-")[1]) : null,
  name: `${code} en DUX - UNIDAD`,
  category: "LESS",
  costCents: 500_000n,
  prices: [{ listId: 1, list: "MAYORISTA EF/TR", cents: 1_000_000 }],
  stockReal: "12",
  stockReserved: "0",
  stockAvailable: "12",
  enabled: true,
  createdOn: new Date("2025-01-15T00:00:00Z"),
  contentHash: code,
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  changedAt: new Date(),
  ...cambios,
});

const producto = (baseCode: string) =>
  db.catalogProduct.findUniqueOrThrow({
    where: { baseCode },
    include: { presentations: { orderBy: { code: "asc" } }, photos: { orderBy: { position: "asc" } } },
  });
const corrida = () => db.syncRun.findFirstOrThrow({ orderBy: { startedAt: "desc" } });
const importar = async () => {
  const bloqueo = await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_IMPORTACION_MS);
  return importarCatalogo(ORIGEN, bloqueo!);
};

const limpiar = async () => {
  await db.catalogProduct.deleteMany();
  await db.catalogSheetRow.deleteMany();
  await db.catalogDriveFile.deleteMany();
  await db.catalogDecision.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
  await db.syncLock.deleteMany();
  await db.integrationCredential.deleteMany();
};

beforeEach(async () => {
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  await limpiar();
  workflow.start.mockReset();
  await db.duxItem.createMany({ data: [itemDeDux("LN1"), itemDeDux("LN1-6"), itemDeDux("LN2"), itemDeDux("LN2-6")] });
  conFuentes([{ sku: "LN1" }, { sku: "LN2" }], "LN1.jpg", "LN1-2.jpg", "LN2.jpg");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("una importación completa", () => {
  it("arma los productos y deja la corrida con lo que hizo", async () => {
    expect(await importar()).toEqual({ status: "ok" });

    expect(await producto("LN1")).toMatchObject({
      name: "LN1 en DUX",
      category: "LESS",
      brand: "Linda Luna",
      lifecycle: "activo",
      readyToSell: true,
      bulkCode: "LN1-6",
      inSheet: true,
      inDux: true,
      sheetRow: 2,
      presentations: [
        { code: "LN1", kind: "prenda", quantity: null, inDux: true },
        { code: "LN1-6", kind: "pack", quantity: 6, inDux: true },
      ],
      photos: [
        { driveId: "id-LN1.jpg", position: 0 },
        { driveId: "id-LN1-2.jpg", position: 1 },
      ],
    });
    expect(await corrida()).toMatchObject({
      integration: "google",
      operation: "catalogo",
      status: "ok",
      trigger: "manual",
      triggeredBy: "Prueba",
      calls: 2,
      records: 2,
      detail:
        "Productos: 2, 2 en las tres fuentes. Nuevos: 2. Cambiados: 0. Ya no están: 0. Para revisar: 0. Filas del Sheet: 2. Archivos de Drive: 3.",
    });
    expect(await db.catalogSheetRow.count()).toBe(2);
    expect(await db.catalogDriveFile.count()).toBe(3);
  });

  it("guarda el mismo ID y la fecha de creación si corre dos veces: nada cambió", async () => {
    await importar();
    const antes = await producto("LN1");

    await importar();

    const despues = await producto("LN1");
    expect(despues.id).toBe(antes.id);
    expect(despues.changedAt).toEqual(antes.changedAt);
    expect(despues.presentations.map(({ id }) => id)).toEqual(antes.presentations.map(({ id }) => id));
    expect((await corrida()).detail).toContain("Nuevos: 0. Cambiados: 0.");
  });

  it("lo que cambió en el Sheet entra, con el mismo producto", async () => {
    await importar();
    const antes = await producto("LN1");

    conFuentes([{ sku: "LN1", tela: "MICROFIBRA" }, { sku: "LN2" }], "LN1.jpg", "LN1-2.jpg", "LN2.jpg");
    await importar();

    const despues = await producto("LN1");
    expect(despues).toMatchObject({ id: antes.id, fabric: "MICROFIBRA", firstSeenAt: antes.firstSeenAt });
    expect(despues.changedAt.getTime()).toBeGreaterThan(antes.changedAt.getTime());
    expect((await corrida()).detail).toContain("Nuevos: 0. Cambiados: 1.");
    expect((await producto("LN2")).changedAt).toEqual((await producto("LN2")).firstSeenAt);
  });

  it("lo que dejó de existir se marca, sin borrarse, y vuelve si reaparece", async () => {
    await importar();
    const { id } = await producto("LN2");

    await db.duxItem.deleteMany({ where: { baseCode: "LN2" } });
    conFuentes([{ sku: "LN1" }], "LN1.jpg", "LN1-2.jpg");
    await importar();

    expect(await producto("LN2")).toMatchObject({ id, present: false, presentations: [], photos: [] });
    expect((await corrida()).detail).toContain("Ya no están: 1.");

    conFuentes([{ sku: "LN1" }, { sku: "LN2" }], "LN1.jpg", "LN1-2.jpg", "LN2.jpg");
    await importar();

    expect(await producto("LN2")).toMatchObject({ id, present: true, presentations: [{ code: "LN2" }], photos: [{}] });
  });

  it("lee sku_nuevo: la fila BORRAR no arma nada", async () => {
    conFuentes([{ sku: "LN1" }, { sku: "LN2", sku_nuevo: "BORRAR" }], "LN1.jpg");

    await importar();

    expect((await producto("LN1")).inSheet).toBe(true);
    expect((await producto("LN2")).inSheet).toBe(false);
  });

  it("vuelve a aplicar las decisiones: una foto suelta sigue en el producto que le dijeron", async () => {
    conFuentes([{ sku: "LN1" }, { sku: "LN2" }], "LN1.jpg", "IMG_0702.JPG");
    await db.catalogDecision.create({
      data: {
        id: newId(),
        type: DECISION_DE_FOTO,
        key: "id-IMG_0702.JPG",
        value: { producto: "LN2" },
        decidedByLabel: "Prueba",
        decidedAt: new Date(),
      },
    });

    await importar();
    await importar();

    expect((await producto("LN2")).photos.map(({ driveId }) => driveId)).toEqual(["id-IMG_0702.JPG"]);
  });
});

describe("cuando algo falla, el catálogo anterior queda entero", () => {
  const conCatalogo = async () => {
    await importar();
    return producto("LN1");
  };

  it("si el Sheet no responde: lo dice, y no llega a pedirle nada a Drive", async () => {
    const antes = await conCatalogo();
    const carpeta = vi.fn(async () => []);
    google.planilla = async () => {
      throw new ExternalServiceError("Google", "Google no respondió.");
    };
    google.carpeta = carpeta;

    expect(await importar()).toEqual({ status: "error" });

    expect(await producto("LN1")).toEqual(antes);
    expect(carpeta).not.toHaveBeenCalled();
    expect(await corrida()).toMatchObject({
      status: "error",
      records: 0,
      detail: "Google no respondió. El catálogo sigue como estaba.",
    });
    expect(await hayCorridaEnCurso("google")).toBe(false);
  });

  it("si Drive no responde, tampoco se arma nada", async () => {
    const antes = await conCatalogo();
    conFuentes([{ sku: "LN1", tela: "OTRA" }]);
    google.carpeta = async () => {
      throw new ExternalServiceError("Google", "Google no respondió.");
    };

    expect(await importar()).toEqual({ status: "error" });

    expect(await producto("LN1")).toEqual(antes);
    expect((await corrida()).calls).toBe(2);
  });

  it("si una columna cambió de nombre, frena y dice cuál", async () => {
    const antes = await conCatalogo();
    google.planilla = async () =>
      planilla(
        [{ sku: "LN1" }],
        ENCABEZADOS.map((e) => (e === "tela" ? "Tela" : e)),
      );

    expect(await importar()).toEqual({ status: "error" });

    expect(await producto("LN1")).toEqual(antes);
    expect((await corrida()).detail).toBe("En el Sheet falta o cambió de nombre: tela. El catálogo sigue como estaba.");
  });

  it("si la carpeta vuelve vacía, no se quedan todos sin fotos", async () => {
    const antes = await conCatalogo();
    conFuentes([{ sku: "LN1" }, { sku: "LN2" }]);

    expect(await importar()).toEqual({ status: "error" });

    expect(await producto("LN1")).toEqual(antes);
  });

  it("si la escritura se corta a mitad de camino, no queda nada a medias", async () => {
    const antes = await conCatalogo();
    // Este archivo ya es de LN2 en la base: al final de la transacción, la foto choca con esa fila.
    const { id: deOtro } = await producto("LN2");
    await db.catalogPhoto.create({
      data: { id: newId(), productId: deOtro, driveId: "id-LN1-9.jpg", name: "x", position: 9 },
    });
    conFuentes([{ sku: "LN1", tela: "OTRA" }, { sku: "LN2" }], "LN1.jpg", "LN1-2.jpg", "LN1-9.jpg", "LN2.jpg");

    await expect(importar()).rejects.toThrow();

    expect(await producto("LN1")).toEqual(antes);
    expect(await hayCorridaEnCurso("google")).toBe(false);
    expect(await corrida()).toMatchObject({ status: "error", detail: "La corrida se cortó antes de terminar." });
  });
});

describe("lo subido en la app", () => {
  const subida = async (baseCode: string) => {
    const { id } = await producto(baseCode);
    await db.catalogPhoto.create({
      data: { id: newId(), productId: id, storageKey: "catalogo/nueva.jpg", name: "nueva.jpg", position: 5 },
    });
  };
  const clave = async (baseCode: string) =>
    (await producto(baseCode)).photos.flatMap(({ storageKey }) => storageKey ?? []);

  it("sobrevive a una importación que cambia el producto, y las de Drive se renuevan", async () => {
    await importar();
    await subida("LN1");
    conFuentes([{ sku: "LN1", tela: "OTRA" }, { sku: "LN2" }], "LN1.jpg", "LN2.jpg");

    expect(await importar()).toEqual({ status: "ok" });

    const { fabric, photos } = await producto("LN1");
    expect(fabric).toBe("OTRA");
    expect(photos.map(({ driveId, storageKey }) => driveId ?? storageKey)).toEqual([
      "id-LN1.jpg",
      "catalogo/nueva.jpg",
    ]);
  });

  it("sobrevive a una importación donde el producto no cambió", async () => {
    await importar();
    await subida("LN1");

    await importar();

    expect(await clave("LN1")).toEqual(["catalogo/nueva.jpg"]);
  });

  it("un producto que deja de estar suelta sus fotos de Drive, pero conserva la suya", async () => {
    await importar();
    await subida("LN1");
    conFuentes([{ sku: "LN2" }], "LN2.jpg");
    await db.duxItem.deleteMany({ where: { baseCode: "LN1" } });

    await importar();

    const { present, photos } = await producto("LN1");
    expect(present).toBe(false);
    expect(photos.map(({ storageKey }) => storageKey)).toEqual(["catalogo/nueva.jpg"]);
  });
});

describe("el corte", () => {
  const cortar = async () => {
    const bloqueo = await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_IMPORTACION_MS);
    return importarCatalogo(ORIGEN, bloqueo!, true);
  };
  const googleCaido = () => {
    google.planilla = async () => {
      throw new ExternalServiceError("Google", "Google no respondió.");
    };
    google.carpeta = async () => {
      throw new ExternalServiceError("Google", "Google no respondió.");
    };
  };

  it("hace la última importación y, si sale bien, queda hecho", async () => {
    conFuentes([{ sku: "LN1", tela: "ULTIMA" }, { sku: "LN2" }], "LN1.jpg", "LN2.jpg");

    expect(await cortar()).toEqual({ status: "ok" });

    expect((await producto("LN1")).fabric).toBe("ULTIMA");
    expect(await estadoDelCorte()).toMatchObject({ por: "Prueba" });
    expect(await hayCorridaEnCurso("google")).toBe(false);
  });

  it("si Google falla, no corta: sigue todo como estaba", async () => {
    await importar();
    const antes = await producto("LN1");
    googleCaido();

    expect(await cortar()).toEqual({ status: "error" });

    expect(await estadoDelCorte()).toBeNull();
    expect(await producto("LN1")).toEqual(antes);
  });

  it("después, no le pide nada a Google, y sigue leyendo DUX", async () => {
    await cortar();
    googleCaido();
    await db.duxItem.update({ where: { code: "LN1" }, data: { name: "LN1 RENOMBRADO - UNIDAD" } });
    await db.duxItem.createMany({ data: [itemDeDux("LN9"), itemDeDux("LN9-6")] });

    expect(await importar()).toEqual({ status: "ok" });

    expect((await producto("LN1")).name).toContain("RENOMBRADO");
    expect(await producto("LN9")).toMatchObject({ inDux: true, inSheet: false });
    expect(await corrida()).toMatchObject({
      status: "ok",
      calls: 0,
      detail: expect.stringContaining("Con el corte hecho, no se lee Google."),
    });
  });

  it("después de sincronizar con DUX se arma igual, aunque se saque la clave de Google", async () => {
    await cortar();
    googleCaido();
    await db.integrationCredential.deleteMany({ where: { integration: "google" } });
    await db.duxItem.createMany({ data: [itemDeDux("LN9"), itemDeDux("LN9-6")] });

    await importarCatalogoTrasDux(ORIGEN);

    expect((await producto("LN9")).inDux).toBe(true);
  });

  it("lo que está en el Sheet ya no pisa lo editado en la app", async () => {
    await cortar();
    conFuentes([{ sku: "LN1", tela: "CAMBIO EN EL SHEET" }, { sku: "LN2" }], "LN1.jpg");

    await importar();

    expect((await producto("LN1")).fabric).toBe("ALGODON");
  });

  it("volver atrás: la próxima lee el Sheet de nuevo, y lo editado se pisa", async () => {
    await cortar();
    const fila = await db.catalogSheetRow.findFirstOrThrow({ where: { rowNumber: 2 } });
    await db.catalogSheetRow.update({
      where: { id: fila.id },
      data: { shown: { ...(fila.shown as object), tela: "EDITADO EN LA APP" } },
    });
    await importarCatalogoSinCorte();
    expect((await producto("LN1")).fabric).toBe("EDITADO EN LA APP");

    await deshacerElCorte();
    conFuentes([{ sku: "LN1", tela: "DEL SHEET" }, { sku: "LN2" }], "LN1.jpg");
    await importar();

    expect((await producto("LN1")).fabric).toBe("DEL SHEET");
  });

  it("las decisiones se mantienen, con corte y con vuelta atrás", async () => {
    conFuentes([{ sku: "LN1" }, { sku: "LN2" }], "LN1.jpg", "IMG_0702.JPG");
    await db.catalogDecision.create({
      data: {
        id: newId(),
        type: DECISION_DE_FOTO,
        key: "id-IMG_0702.JPG",
        value: { producto: "LN2" },
        decidedByLabel: "Prueba",
        decidedAt: new Date(),
      },
    });
    const dondeEsta = async () => (await producto("LN2")).photos.map(({ driveId }) => driveId);

    await cortar();
    expect(await dondeEsta()).toContain("id-IMG_0702.JPG");

    await importarCatalogoSinCorte();
    expect(await dondeEsta()).toContain("id-IMG_0702.JPG");

    await deshacerElCorte();
    await importar();
    expect(await dondeEsta()).toContain("id-IMG_0702.JPG");
  });

  it("el botón lo lanza como la última importación", async () => {
    workflow.start.mockResolvedValue({ runId: "wrun_02" });

    expect(await arrancarElCorte(ORIGEN)).toEqual({ arrancada: true, runId: "wrun_02" });

    const [funcion, argumentos] = workflow.start.mock.calls[0] as [unknown, unknown[]];
    expect(funcion).toBe(importarCatalogo);
    expect(argumentos[2]).toBe(true);
    expect(await arrancarElCorte(ORIGEN)).toEqual({ arrancada: false });
  });

  it("si no se pudo lanzar, suelta el bloqueo", async () => {
    workflow.start.mockRejectedValue(new Error("sin workflow"));

    await expect(arrancarElCorte(ORIGEN)).rejects.toThrow("sin workflow");

    expect(await hayCorridaEnCurso("google")).toBe(false);
  });

  const importarCatalogoSinCorte = () => importar();
});

describe("las filas cargadas en la app", () => {
  const filaDeLaApp = (sku: string, tela: string, cambios: Record<string, unknown> = {}) =>
    db.catalogSheetRow.create({
      data: {
        id: newId(),
        rowNumber: 1_000_001 + Math.floor(Math.random() * 1000),
        source: "app",
        shown: { SKU: sku, "Nombre de DUX": `${sku} DE LA APP`, tela, categoria_tn: "LESS" },
        raw: { SKU: sku, tela },
        readAt: new Date(),
        ...cambios,
      },
    });

  beforeEach(async () => {
    await db.duxItem.createMany({ data: [itemDeDux("ZZ1"), itemDeDux("ZZ1-6")] });
  });

  it("una importación no las borra", async () => {
    await filaDeLaApp("ZZ1", "DE LA APP");

    await importar();
    await importar();

    expect(await producto("ZZ1")).toMatchObject({ fabric: "DE LA APP", inSheet: true, sheetRow: null });
  });

  it("si el Sheet ya tiene ese código, manda el Sheet, y no queda repetido", async () => {
    await filaDeLaApp("LN1", "DE LA APP");

    await importar();

    expect(await producto("LN1")).toMatchObject({ fabric: "ALGODON", sheetRow: 2 });
    const casos = await db.catalogReviewCase.findMany({ where: { baseCode: "LN1" } });
    expect(casos.filter(({ block }) => block === "codigo_repetido")).toEqual([]);
  });
});

describe("nunca hay dos a la vez", () => {
  it("el botón la lanza, y un segundo apretón no lanza otra", async () => {
    workflow.start.mockResolvedValue({ runId: "wrun_01" });

    expect(await arrancarImportacionDelCatalogo(ORIGEN)).toEqual({ arrancada: true, runId: "wrun_01" });
    expect(await hayCorridaEnCurso("google")).toBe(true);
    expect(await arrancarImportacionDelCatalogo(ORIGEN)).toEqual({ arrancada: false });

    expect(workflow.start).toHaveBeenCalledOnce();
    const [funcion] = workflow.start.mock.calls[0] as [unknown];
    expect(funcion).toBe(importarCatalogo);
  });

  it("si no se pudo lanzar, suelta el bloqueo", async () => {
    workflow.start.mockRejectedValue(new Error("sin workflow"));

    await expect(arrancarImportacionDelCatalogo(ORIGEN)).rejects.toThrow("sin workflow");

    expect(await hayCorridaEnCurso("google")).toBe(false);
  });
});

describe("después de sincronizar con DUX", () => {
  const conClave = () => guardarCredencial("google", '{"client_email":"a@b.c"}', { id: newId(), label: "Prueba" });

  it("sin la clave cargada no hace nada: el catálogo no está conectado en este ambiente", async () => {
    expect(await importarCatalogoTrasDux(ORIGEN)).toEqual({ status: "omitida" });

    expect(await db.syncRun.count()).toBe(0);
    expect(await db.catalogProduct.count()).toBe(0);
  });

  it("con la clave, importa con lo que DUX acaba de traer", async () => {
    await conClave();

    expect(await importarCatalogoTrasDux(ORIGEN)).toEqual({ status: "ok" });

    expect((await producto("LN1")).inDux).toBe(true);
    expect(await hayCorridaEnCurso("google")).toBe(false);
  });

  it("si ya hay una en curso, no lanza otra", async () => {
    await conClave();
    await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_IMPORTACION_MS);

    expect(await importarCatalogoTrasDux(ORIGEN)).toEqual({ status: "omitida" });

    expect(await db.syncRun.count()).toBe(0);
  });
});
