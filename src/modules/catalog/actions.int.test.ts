import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { RevisionCaso, RevisionDecision, RevisionResumen } from "@/lib/api/contracts/catalogo";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import type { Paginated } from "@/lib/api/types";
import { getAuth } from "@/modules/platform/auth/auth";
import { tomarBloqueo } from "@/modules/platform/sync-runs";
import { confirmarHistoricos, decidirFotoSuelta, deshacerDecisionDelCatalogo, noEsHistorico } from "./actions";
import { armarDesdeLasCopias, BLOQUEO_DEL_CATALOGO } from "./importar";

// Las acciones leen la sesión de los headers del request: acá, los del usuario de prueba.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

const db = getDb();
const sufijo = Date.now();
const email = (nombre: string) => `${nombre}+cat${sufijo}@vx3.test`;
const PASSWORD = "contraseña del usuario de prueba";

async function entrar(correo: string) {
  const { headers } = await getAuth().api.signInEmail({
    body: { email: correo, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = /((?:__Secure-)?vx3\.session_token=[^;]+)/.exec(headers.get("set-cookie") ?? "")?.[1];
  if (!cookie) throw new Error("No vino la cookie de sesión");
  return new Headers({ cookie });
}

let compras = new Headers();
let marketing = new Headers();

beforeAll(async () => {
  const crear = (nombre: string, role: "compras" | "marketing") =>
    getAuth().api.createUser({
      body: {
        email: email(nombre),
        name: `Prueba ${nombre}`,
        password: PASSWORD,
        role,
        data: { mustChangePassword: false },
      },
    });
  await crear("compras", "compras");
  await crear("marketing", "marketing");
  compras = await entrar(email("compras"));
  marketing = await entrar(email("marketing"));
});

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

const filaDelSheet = (rowNumber: number, sku: string, cambios: Record<string, unknown> = {}) => {
  const visto = {
    SKU: sku,
    "Nombre de DUX": `Nombre de ${sku}`,
    categoria_tn: "LESS",
    marca_comercial: "Linda Luna",
    Proveedor: "BETHY",
    tela: "ALGODON",
    ...cambios,
  };
  return {
    id: newId(),
    rowNumber,
    shown: visto,
    raw: { peso: 0.25, largo: 25, ancho: 15, alto: 10, ...visto },
    readAt: new Date(),
  };
};

const archivo = (nombre: string) => ({
  id: newId(),
  driveId: `id-${nombre}`,
  name: nombre,
  mimeType: "image/jpeg",
  md5: `md5-${nombre}`,
  folder: "Repositorio Fotos",
  readAt: new Date(),
});

const SIN_STOCK = { stockReal: "0", stockAvailable: "0" };

const limpiar = async () => {
  await db.catalogProduct.deleteMany();
  await db.catalogReviewCase.deleteMany();
  await db.catalogSheetRow.deleteMany();
  await db.catalogDriveFile.deleteMany();
  await db.catalogDecision.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncRun.deleteMany();
  await db.syncLock.deleteMany();
};

/** LN1 está completo, LN2 no tiene peso, HIST1 y HIST2 son históricos, y hay una foto suelta. */
const semilla = async () => {
  await db.duxItem.createMany({
    data: [
      itemDeDux("LN1"),
      itemDeDux("LN1-6"),
      itemDeDux("LN2"),
      itemDeDux("LN2-6"),
      itemDeDux("HIST1", SIN_STOCK),
      itemDeDux("HIST1-6", SIN_STOCK),
      itemDeDux("HIST2", SIN_STOCK),
      itemDeDux("HIST2-6", SIN_STOCK),
    ],
  });
  await db.catalogSheetRow.createMany({
    data: [
      filaDelSheet(2, "LN1"),
      { ...filaDelSheet(3, "LN2"), raw: { peso: "", largo: 25, ancho: 15, alto: 10 } },
      filaDelSheet(4, "HIST1"),
      filaDelSheet(5, "HIST2"),
    ],
  });
  await db.catalogDriveFile.createMany({
    data: [archivo("LN1.jpg"), archivo("LN2.jpg"), archivo("HIST1.jpg"), archivo("HIST2.jpg"), archivo("IMG_0702.JPG")],
  });
  await armarDesdeLasCopias(new Date());
};

const casos = (block: string) => db.catalogReviewCase.findMany({ where: { block }, orderBy: { key: "asc" } });
const producto = (baseCode: string) =>
  db.catalogProduct.findUniqueOrThrow({ where: { baseCode }, include: { photos: true } });

beforeEach(async () => {
  await limpiar();
  request.headers = compras;
  await semilla();
});

afterAll(async () => {
  await limpiar();
  await db.user.deleteMany({ where: { email: { endsWith: `+cat${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

describe("la cola se llena con la importación", () => {
  it("dice qué hay en cada bloque", async () => {
    expect((await casos("envio")).map(({ key }) => key)).toEqual(["LN2"]);
    expect((await casos("historicos")).map(({ key }) => key)).toEqual(["HIST1", "HIST2"]);
    expect((await casos("fotos_sueltas")).map(({ key }) => key)).toEqual(["id-IMG_0702.JPG"]);
  });

  it("se vacía sola: lo corregido en el Sheet desaparece en la importación siguiente", async () => {
    await db.catalogSheetRow.update({
      where: { rowNumber: 3 },
      data: { raw: { peso: 0.25, largo: 25, ancho: 15, alto: 10 } },
    });

    await armarDesdeLasCopias(new Date());

    expect(await casos("envio")).toEqual([]);
  });

  it("dos corridas iguales dan la misma cola", async () => {
    const antes = await db.catalogReviewCase.count();

    await armarDesdeLasCopias(new Date());

    expect(await db.catalogReviewCase.count()).toBe(antes);
  });
});

describe("la foto suelta", () => {
  it("va al producto que dijo una persona, y queda en cualquier importación que siga", async () => {
    expect(await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "lN 2" })).toEqual({
      ok: true,
      data: { aplicada: true },
    });

    expect(await casos("fotos_sueltas")).toEqual([]);
    expect((await producto("LN2")).photos.map(({ driveId }) => driveId)).toContain("id-IMG_0702.JPG");

    await armarDesdeLasCopias(new Date());

    expect((await producto("LN2")).photos.map(({ driveId }) => driveId)).toContain("id-IMG_0702.JPG");
    expect(await db.catalogDecision.findFirst({ where: { key: "id-IMG_0702.JPG" } })).toMatchObject({
      type: "foto",
      value: { producto: "LN2" },
      decidedByLabel: "Prueba compras",
    });
  });

  it("se puede descartar", async () => {
    await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: null });

    expect(await casos("fotos_sueltas")).toEqual([]);
    expect(await db.catalogPhoto.count({ where: { driveId: "id-IMG_0702.JPG" } })).toBe(0);
  });

  it("se puede cambiar de idea", async () => {
    await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "LN1" });
    await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "LN2" });

    expect((await producto("LN1")).photos.map(({ driveId }) => driveId)).not.toContain("id-IMG_0702.JPG");
    expect((await producto("LN2")).photos.map(({ driveId }) => driveId)).toContain("id-IMG_0702.JPG");
  });

  it("se puede deshacer: vuelve a la cola", async () => {
    await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "LN2" });

    await deshacerDecisionDelCatalogo({ tipo: "foto", clave: "id-IMG_0702.JPG" });

    expect(await casos("fotos_sueltas")).toHaveLength(1);
    expect((await producto("LN2")).photos.map(({ driveId }) => driveId)).not.toContain("id-IMG_0702.JPG");
  });

  it("un producto que no existe no se acepta", async () => {
    expect(await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "NOEXISTE1" })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", message: "No existe el producto NOEXISTE1." },
    });
    expect(await db.catalogDecision.count()).toBe(0);
  });

  it("una foto que ya no está en Drive tampoco", async () => {
    expect(await decidirFotoSuelta({ driveId: "otra", producto: "LN1" })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("los históricos", () => {
  it("se confirman en bloque, con una excepción", async () => {
    await noEsHistorico({ producto: "HIST2" });

    expect(await producto("HIST2")).toMatchObject({ lifecycle: "agotado" });
    expect((await casos("historicos")).map(({ key }) => key)).toEqual(["HIST1"]);

    expect(await confirmarHistoricos({})).toEqual({ ok: true, data: { confirmados: 1, aplicada: true } });

    expect(await casos("historicos")).toEqual([]);
    expect(await producto("HIST1")).toMatchObject({ lifecycle: "historico" });
    expect(await producto("HIST2")).toMatchObject({ lifecycle: "agotado" });
  });

  it("la decisión sigue después de reimportar", async () => {
    await noEsHistorico({ producto: "HIST2" });
    await confirmarHistoricos({});

    await armarDesdeLasCopias(new Date());

    expect(await casos("historicos")).toEqual([]);
    expect(await producto("HIST2")).toMatchObject({ lifecycle: "agotado" });
  });

  it("si vuelve a tener stock, vuelve solo como activo", async () => {
    await confirmarHistoricos({});

    await db.duxItem.update({ where: { code: "HIST1" }, data: { stockReal: "12", stockAvailable: "12" } });
    await armarDesdeLasCopias(new Date());

    expect(await producto("HIST1")).toMatchObject({ lifecycle: "activo" });
  });

  it("uno nuevo que cae después queda para confirmar", async () => {
    await confirmarHistoricos({});

    await db.duxItem.update({ where: { code: "LN1" }, data: SIN_STOCK });
    await armarDesdeLasCopias(new Date());

    expect((await casos("historicos")).map(({ key }) => key)).toEqual(["LN1"]);
  });

  it("una excepción se puede deshacer", async () => {
    await noEsHistorico({ producto: "HIST2" });

    await deshacerDecisionDelCatalogo({ tipo: "historico", clave: "HIST2" });

    expect(await producto("HIST2")).toMatchObject({ lifecycle: "historico" });
    expect((await casos("historicos")).map(({ key }) => key)).toContain("HIST2");
  });

  it("la confirmación en bloque se puede deshacer, sin tocar las excepciones", async () => {
    await noEsHistorico({ producto: "HIST2" });
    await confirmarHistoricos({});

    await deshacerDecisionDelCatalogo({ tipo: "historico", clave: null });

    expect((await casos("historicos")).map(({ key }) => key)).toEqual(["HIST1"]);
    expect(await producto("HIST2")).toMatchObject({ lifecycle: "agotado" });
  });
});

describe("mientras corre una importación", () => {
  it("la decisión se guarda igual, y avisa que se aplica después", async () => {
    await tomarBloqueo(BLOQUEO_DEL_CATALOGO, 60_000);

    expect(await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "LN2" })).toEqual({
      ok: true,
      data: { aplicada: false },
    });

    expect(await db.catalogDecision.count()).toBe(1);
    expect((await producto("LN2")).photos.map(({ driveId }) => driveId)).not.toContain("id-IMG_0702.JPG");
  });
});

describe("los permisos", () => {
  it("un rol que solo ve el catálogo no decide nada", async () => {
    request.headers = marketing;

    for (const resultado of [
      await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "LN2" }),
      await noEsHistorico({ producto: "HIST1" }),
      await confirmarHistoricos({}),
      await deshacerDecisionDelCatalogo({ tipo: "historico", clave: null }),
    ]) {
      expect(resultado).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    expect(await db.catalogDecision.count()).toBe(0);
  });

  it("queda en la auditoría", async () => {
    await confirmarHistoricos({});

    expect(
      await db.auditLog.findFirst({ where: { action: "catalogo.historicos" }, orderBy: { occurredAt: "desc" } }),
    ).toMatchObject({
      actorLabel: "Prueba compras",
    });
  });
});

describe("lo que muestra la API", () => {
  const pedir = async <T>(ruta: string, role: "admin" | "solo_lectura" = "admin") => {
    const respuesta = await dispatchApiRequest(new Request(`http://app.local/api/v1${ruta}`), {
      user: { role },
      realDomains: ["catalogo"],
    });
    return { status: respuesta.status, cuerpo: (await respuesta.json()) as T };
  };

  it("el resumen cuenta por bloque, con los vacíos también", async () => {
    const { cuerpo } = await pedir<RevisionResumen>("/catalogo/revision");
    const de = (id: string) => cuerpo.bloques.find((bloque) => bloque.id === id);

    expect(de("envio")).toMatchObject({ casos: 1, grupo: "para_vender", titulo: "Peso y medidas que faltan" });
    expect(de("historicos")).toMatchObject({ casos: 2, grupo: "historicos" });
    expect(de("codigos")).toMatchObject({ casos: 0 });
    expect(cuerpo.casos).toBe(4);
  });

  it("los casos de un bloque traen el producto y dónde se corrige", async () => {
    const { cuerpo } = await pedir<Paginated<RevisionCaso>>("/catalogo/revision/casos?bloque=envio");

    expect(cuerpo).toMatchObject({
      total: 1,
      data: [{ sku: "LN2", nombre: "LN2", descripcion: "Sin peso.", seCorrigeEn: "Sheet, fila 3", foto: null }],
    });
  });

  it("una foto suelta trae su miniatura y sus sugerencias", async () => {
    const { cuerpo } = await pedir<Paginated<RevisionCaso>>("/catalogo/revision/casos?bloque=fotos_sueltas");

    expect(cuerpo.data[0]).toMatchObject({
      clave: "id-IMG_0702.JPG",
      sku: null,
      seCorrigeEn: "En esta pantalla",
      foto: {
        nombre: "IMG_0702.JPG",
        miniatura: "https://drive.google.com/thumbnail?id=id-IMG_0702.JPG&sz=w400",
        sugerencias: [],
      },
    });
  });

  it("ordena por ventas", async () => {
    await db.catalogReviewCase.updateMany({ where: { key: "HIST2" }, data: { salesRank: 1 } });

    const { cuerpo } = await pedir<Paginated<RevisionCaso>>("/catalogo/revision/casos?bloque=historicos");

    expect(cuerpo.data.map(({ sku }) => sku)).toEqual(["HIST2", "HIST1"]);
  });

  it("un bloque que no existe no trae nada", async () => {
    const { cuerpo } = await pedir<Paginated<RevisionCaso>>("/catalogo/revision/casos?bloque=otro");

    expect(cuerpo.total).toBe(0);
  });

  it("muestra lo decidido, con quién y la confirmación en una sola línea", async () => {
    await noEsHistorico({ producto: "HIST2" });
    await decidirFotoSuelta({ driveId: "id-IMG_0702.JPG", producto: "LN2" });
    await confirmarHistoricos({});

    const { cuerpo } = await pedir<RevisionDecision[]>("/catalogo/revision/decisiones");

    expect(cuerpo.map(({ descripcion, quien }) => [descripcion, quien])).toEqual(
      expect.arrayContaining([
        ["1 histórico confirmado", "Prueba compras"],
        ["HIST2 no es histórico", "Prueba compras"],
        ["IMG_0702.JPG va en LN2", "Prueba compras"],
      ]),
    );
    expect(cuerpo).toHaveLength(3);
  });

  it("un rol sin el área de productos no entra", async () => {
    expect((await pedir("/catalogo/revision", "solo_lectura")).status).toBe(403);
  });
});
