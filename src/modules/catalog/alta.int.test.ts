import { del } from "@vercel/blob";
import { getPayloadFromClientToken } from "@vercel/blob/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type {
  CatalogoAltaInput,
  CatalogoAltaOpciones,
  CatalogoBorrador,
  CatalogoParecido,
} from "@/lib/api/contracts/catalogo";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import { getAuth } from "@/modules/platform/auth/auth";
import { borrarBorradorDeAlta, descartarFotosSubidas, guardarBorradorDeAlta } from "./actions";
import { guardarReferencias, opcionesDeAlta } from "./alta-consultas";

// Las acciones leen la sesión de los headers del request: acá, los del usuario de prueba.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));

const MEDIA = "https://abc.public.blob.vercel-storage.com";
const url = (clave: string) => `${MEDIA}/${clave}`;

const db = getDb();
const sufijo = Date.now();
const email = (nombre: string) => `${nombre}+alta${sufijo}@vx3.test`;
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

const itemDeDux = (code: string, category: string, subcategory: string, cambios: Record<string, unknown> = {}) => ({
  id: newId(),
  code,
  normalizedCode: code,
  kind: code.includes("-") ? ("pack" as const) : ("prenda" as const),
  baseCode: code.split("-")[0]!,
  packQuantity: code.includes("-") ? Number(code.split("-")[1]) : null,
  name: code,
  category,
  subcategory,
  costCents: 0n,
  prices: [],
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

const producto = (baseCode: string, cambios: Record<string, unknown> = {}) =>
  db.catalogProduct.create({
    data: {
      id: newId(),
      baseCode,
      name: baseCode,
      isCombo: false,
      attributes: {},
      lifecycle: "activo",
      seasonal: false,
      priority: "C",
      sales90dCents: 0n,
      missing: [],
      readyToSell: true,
      inSheet: true,
      inDux: true,
      searchText: baseCode.toLowerCase(),
      contentHash: baseCode,
      firstSeenAt: new Date(),
      changedAt: new Date(),
      ...cambios,
    },
  });

const REFERENCIAS = {
  rubros: [
    { id: 1, nombre: "HOMBRE" },
    { id: 2, nombre: "MEDIAS" },
    { id: 3, nombre: "COMBOS" },
    { id: 4, nombre: "PRUEBAS" },
    { id: 5, nombre: "VACIO" },
  ],
  subrubros: [
    { id: 10, rubroId: 1, nombre: "BOXER" },
    { id: 11, rubroId: 1, nombre: "BERMUDA" },
    { id: 12, rubroId: 2, nombre: "SOQUETES HOMBRE" },
    { id: 13, rubroId: 3, nombre: "LENCERIA" },
    { id: 14, rubroId: 4, nombre: "PRUEBA" },
  ],
  proveedores: [
    { id: 7, nombre: "BETHY", habilitado: true },
    { id: 8, nombre: "DADO DE BAJA", habilitado: false },
    { id: 9, nombre: "EDESUR", habilitado: true },
  ],
  listas: [{ id: 71695, nombre: "MAYORISTA EF/TR", habilitado: true }],
};

const INPUT = {
  sku: "HB9",
  rubro: "HOMBRE",
  subrubro: "BOXER",
  nombre: "BOXER SMART",
  prenda: "BOXER",
  color: "NEGRO",
  copa: "",
  marca: "",
  proveedorId: "7",
  tela: "",
  colores: [],
  talles: "M A XL",
  atributos: {},
  opcionales: {},
  costoDocena: 0,
  pesoBultoKg: 0,
  medidasCm: [0, 0, 0],
  fotos: [],
} satisfies CatalogoAltaInput;

const limpiar = async () => {
  await db.catalogDraft.deleteMany();
  await db.catalogProduct.deleteMany();
  await db.duxReference.deleteMany();
  await db.duxUsedCode.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxItem.deleteMany();
};

beforeEach(async () => {
  await limpiar();
  request.headers = compras;
  vi.mocked(del).mockClear();
  vi.stubEnv("MEDIA_URL", MEDIA);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_abc_secreto");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.user.deleteMany({ where: { email: { endsWith: `+alta${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

describe("las opciones del formulario", () => {
  const conDatos = async () => {
    await guardarReferencias(REFERENCIAS, new Date());
    await db.duxItem.createMany({
      data: [
        itemDeDux("HB5", "HOMBRE", "BOXER", { brand: "UOMO", supplierId: 7 }),
        itemDeDux("HB6", "HOMBRE", "BOXER", { brand: "SMART SEXY" }),
        itemDeDux("MSH3", "MEDIAS", "SOQUETES HOMBRE"),
      ],
    });
    await db.duxUsedCode.create({ data: { code: "HB9-6", normalizedCode: "HB9-6", firstSeenAt: new Date() } });
  };

  it("los rubros salen de DUX, sin lo que no se da de alta desde acá", async () => {
    await conDatos();

    const { rubros } = await opcionesDeAlta();

    expect(rubros.map(({ rubro }) => rubro)).toEqual(["HOMBRE", "MEDIAS"]);
  });

  it("cada subrubro trae su prefijo y su próximo código, contando lo inhabilitado", async () => {
    await conDatos();

    const { rubros } = await opcionesDeAlta();

    expect(rubros[0]?.subrubros).toEqual([
      { nombre: "BERMUDA", prefijo: null, proximoSku: null },
      { nombre: "BOXER", prefijo: "HB", proximoSku: "HB10" },
    ]);
    expect(rubros[1]).toMatchObject({
      familia: "medias",
      subrubros: [{ nombre: "SOQUETES HOMBRE", prefijo: "MSH", proximoSku: "MSH4" }],
    });
  });

  it("ofrece los proveedores habilitados, marcando los que tienen productos, y las marcas de DUX", async () => {
    await conDatos();

    const { proveedores, marcas } = await opcionesDeAlta();

    expect(proveedores).toEqual([
      { id: "7", nombre: "BETHY", conProductos: true },
      { id: "9", nombre: "EDESUR", conProductos: false },
    ]);
    expect(marcas).toEqual(["SMART SEXY", "UOMO"]);
  });

  it("tela y atributos salen de lo que se usa hoy, unidos y con los más usados primero", async () => {
    await producto("LN5", { attributes: { copa: "NO" } });
    await producto("LN6", { attributes: { copa: "NO" } });
    await producto("LN1", { fabric: "ALGODON", attributes: { copa: "B", encaje: "SI" } });
    await producto("LN2", { fabric: "ALGODÓN", attributes: { copa: "B", encaje: "si" } });
    await producto("LN3", { fabric: "ALGODON", attributes: { copa: "A", encaje: "SI" } });
    await producto("LN4", { fabric: "ENCAJE", attributes: { encaje: "NO" } });

    const { telas, atributos } = await opcionesDeAlta();

    expect(telas).toEqual(["ALGODON", "ENCAJE"]);
    expect(atributos.find(({ clave }) => clave === "copa")).toEqual({ clave: "copa", label: "Copa", opciones: ["B"] });
    expect(atributos.find(({ clave }) => clave === "encaje")?.opciones).toEqual(["SI"]);
  });

  it("los colores corrigen los errores de tipeo y dejan afuera lo que casi nadie usa", async () => {
    for (let i = 0; i < 10; i++) await producto(`LN${i}`, { colors: "NEGRA, BIEGE, ETC, RARO." });
    await producto("LN99", { colors: "NEGRO" });
    await producto("LN98", { colors: "UNICO" });

    const { colores } = await opcionesDeAlta();

    expect(colores).toEqual(["NEGRO", "BEIGE", "RARO"]);
  });

  it("los códigos usados incluyen los inhabilitados", async () => {
    await conDatos();

    expect((await opcionesDeAlta()).codigosUsados).toEqual(expect.arrayContaining(["HB5", "HB9", "MSH3"]));
  });
});

describe("las referencias", () => {
  it("se reemplazan enteras: lo que DUX ya no manda deja de ofrecerse", async () => {
    await guardarReferencias(REFERENCIAS, new Date());
    await guardarReferencias({ ...REFERENCIAS, rubros: [{ id: 2, nombre: "MEDIAS" }] }, new Date());

    const { rubros } = await opcionesDeAlta();

    expect(rubros.map(({ rubro }) => rubro)).toEqual(["MEDIAS"]);
  });

  it("un mismo ID de subrubro en dos rubros no choca", async () => {
    await guardarReferencias(
      {
        ...REFERENCIAS,
        subrubros: [
          { id: 4, rubroId: 1, nombre: "BOXER" },
          { id: 4, rubroId: 2, nombre: "SOQUETES HOMBRE" },
        ],
      },
      new Date(),
    );

    expect(await db.duxReference.count({ where: { kind: "subrubro" } })).toBe(2);
  });
});

describe("los borradores", () => {
  it("sobreviven a recargar: se guardan, se leen y se actualizan", async () => {
    const creado = await guardarBorradorDeAlta({ id: null, input: INPUT });
    if (!creado.ok) throw new Error("No se guardó");

    const segundo = await guardarBorradorDeAlta({ id: creado.data.id, input: { ...INPUT, prenda: "BOXER LARGO" } });

    expect(segundo).toMatchObject({ ok: true, data: { id: creado.data.id } });
    const respuesta = await dispatchApiRequest(new Request("http://app.local/api/v1/catalogo/alta/borradores"), {
      user: { role: "admin" },
      realDomains: ["catalogo"],
    });
    const borradores = (await respuesta.json()) as CatalogoBorrador[];
    expect(borradores).toMatchObject([
      { id: creado.data.id, quien: "Prueba compras", input: { prenda: "BOXER LARGO", sku: "HB9" } },
    ]);
  });

  it("un borrador incompleto se guarda igual: para eso está", async () => {
    expect(await guardarBorradorDeAlta({ id: null, input: { ...INPUT, sku: "", prenda: "" } })).toMatchObject({
      ok: true,
    });
  });

  it("se puede borrar", async () => {
    const creado = await guardarBorradorDeAlta({ id: null, input: INPUT });
    if (!creado.ok) throw new Error("No se guardó");

    expect(await borrarBorradorDeAlta({ id: creado.data.id })).toMatchObject({ ok: true });

    expect(await db.catalogDraft.count()).toBe(0);
  });

  it("si ya no está, lo dice", async () => {
    expect(await guardarBorradorDeAlta({ id: newId(), input: INPUT })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("un rol que solo ve el catálogo no guarda ni borra", async () => {
    request.headers = marketing;

    expect(await guardarBorradorDeAlta({ id: null, input: INPUT })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await db.catalogDraft.count()).toBe(0);
  });
});

describe("las fotos", () => {
  const foto = (nombre: string) => ({ clave: `catalogo/${nombre}`, nombre, ancho: 800, alto: 800 });
  const guardada = async (...nombres: string[]) => {
    const resultado = await guardarBorradorDeAlta({ id: null, input: { ...INPUT, fotos: nombres.map(foto) } });
    if (!resultado.ok) throw new Error("No se guardó");
    return resultado.data.id;
  };

  it("el borrador conserva las fotos y su orden: la primera es la principal", async () => {
    const id = await guardada("b.jpg", "a.jpg");

    const fila = await db.catalogDraft.findUniqueOrThrow({ where: { id } });

    expect((fila.data as CatalogoAltaInput).fotos.map(({ clave }) => clave)).toEqual([
      "catalogo/b.jpg",
      "catalogo/a.jpg",
    ]);
  });

  it("una foto fuera de la carpeta del catálogo no entra al borrador", async () => {
    const fotos = [{ ...foto("x.jpg"), clave: "comprobantes/x.jpg" }];

    expect(await guardarBorradorDeAlta({ id: null, input: { ...INPUT, fotos } })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
  });

  it("guardar sin una foto la borra del store; reordenar no borra nada", async () => {
    const id = await guardada("a.jpg", "b.jpg");

    await guardarBorradorDeAlta({ id, input: { ...INPUT, fotos: [foto("b.jpg"), foto("a.jpg")] } });
    expect(del).not.toHaveBeenCalled();

    await guardarBorradorDeAlta({ id, input: { ...INPUT, fotos: [foto("b.jpg")] } });
    expect(del).toHaveBeenCalledExactlyOnceWith([url("catalogo/a.jpg")], expect.anything());
  });

  it("borrar el borrador se lleva sus fotos", async () => {
    const id = await guardada("a.jpg", "b.jpg");

    await borrarBorradorDeAlta({ id });

    expect(del).toHaveBeenCalledExactlyOnceWith([url("catalogo/a.jpg"), url("catalogo/b.jpg")], expect.anything());
  });

  it("una foto que todavía usa otro borrador no se borra", async () => {
    await guardada("compartida.jpg");
    const id = await guardada("compartida.jpg", "propia.jpg");

    await borrarBorradorDeAlta({ id });

    expect(del).toHaveBeenCalledExactlyOnceWith([url("catalogo/propia.jpg")], expect.anything());
  });

  it("una foto que ya es de un producto no se borra", async () => {
    const { id: productId } = await producto("LN1");
    await db.catalogPhoto.create({
      data: { id: newId(), productId, storageKey: "catalogo/publicada.jpg", name: "x", position: 0 },
    });
    const id = await guardada("publicada.jpg");

    await borrarBorradorDeAlta({ id });

    expect(del).not.toHaveBeenCalled();
  });

  it("descartar una foto recién subida la borra; si está en un borrador, espera a que se guarde sin ella", async () => {
    await guardada("guardada.jpg");

    await descartarFotosSubidas({ claves: ["catalogo/guardada.jpg"] });
    expect(del).not.toHaveBeenCalled();

    await descartarFotosSubidas({ claves: ["catalogo/recien.jpg"] });
    expect(del).toHaveBeenCalledExactlyOnceWith([url("catalogo/recien.jpg")], expect.anything());
  });

  it("no se puede pedir que borre algo fuera del catálogo, ni con un rol que solo ve", async () => {
    expect(await descartarFotosSubidas({ claves: ["comprobantes/x.jpg"] })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });

    request.headers = marketing;
    expect(await descartarFotosSubidas({ claves: ["catalogo/x.jpg"] })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("si el store no responde, el borrador se guarda igual", async () => {
    vi.mocked(del).mockRejectedValueOnce(new Error("Blob no responde"));
    const id = await guardada("a.jpg");

    expect(await guardarBorradorDeAlta({ id, input: { ...INPUT, fotos: [] } })).toMatchObject({ ok: true });
  });
});

describe("el permiso de subida", () => {
  const pedir = (rol: string, pathname: string, type = "blob.generate-client-token") =>
    dispatchApiRequest(
      new Request("http://app.local/api/v1/catalogo/alta/fotos", {
        method: "POST",
        body: JSON.stringify({ type, payload: { pathname, multipart: false, clientPayload: null } }),
      }),
      { user: { role: rol as "admin" }, realDomains: ["catalogo"] },
    );

  it("exige el tipo y el tamaño en el store: no alcanza con saltearse el formulario", async () => {
    const respuesta = await pedir("compras", "catalogo/top.jpg");

    expect(respuesta.status).toBe(200);
    const { clientToken } = (await respuesta.json()) as { clientToken: string };
    expect(getPayloadFromClientToken(clientToken)).toMatchObject({
      pathname: "catalogo/top.jpg",
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
      maximumSizeInBytes: 10 * 1024 * 1024,
      addRandomSuffix: true,
    });
  });

  it("vence a los 10 minutos", async () => {
    const antes = Date.now();

    const { clientToken } = (await (await pedir("compras", "catalogo/top.jpg")).json()) as { clientToken: string };

    const { validUntil } = getPayloadFromClientToken(clientToken);
    expect(validUntil).toBeGreaterThanOrEqual(antes + 9 * 60 * 1000);
    expect(validUntil).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000);
  });

  it("no da permiso fuera de la carpeta del catálogo", async () => {
    expect((await pedir("compras", "comprobantes/x.jpg")).status).toBe(400);
    expect((await pedir("compras", "catalogo/../x.jpg")).status).toBe(400);
  });

  it("un rol que solo ve el catálogo no sube", async () => {
    expect((await pedir("marketing", "catalogo/top.jpg")).status).toBe(403);
  });

  it("no acepta otro tipo de pedido", async () => {
    expect((await pedir("compras", "catalogo/top.jpg", "blob.upload-completed")).status).toBe(400);
  });

  it("sin store en este ambiente lo dice", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    const respuesta = await pedir("compras", "catalogo/top.jpg");

    expect(respuesta.status).toBe(503);
  });

  it("las opciones avisan si hay store", async () => {
    expect((await opcionesDeAlta()).mediaUrl).toBe(MEDIA);

    vi.stubEnv("MEDIA_URL", "");
    expect((await opcionesDeAlta()).mediaUrl).toBeNull();
  });
});

describe("antes de crear", () => {
  const buscar = async (q: string) => {
    const respuesta = await dispatchApiRequest(
      new Request(`http://app.local/api/v1/catalogo/alta/parecidos?q=${encodeURIComponent(q)}`),
      { user: { role: "admin" }, realDomains: ["catalogo"] },
    );
    return (await respuesta.json()) as CatalogoParecido[];
  };

  it("encuentra lo que se parece, históricos incluidos, con lo que hace falta para reconocerlo", async () => {
    await producto("CTSPN1", {
      name: "TOP SEGUNDA PIEL TIRA FINA",
      searchText: "ctspn1 top segunda piel tira fina",
      colors: "NEGRO, BLANCO",
      lifecycle: "historico",
    });
    await producto("LN1", { name: "LESS ALGODON", searchText: "ln1 less algodon" });

    expect(await buscar("top segunda piel tira ancha")).toMatchObject([
      {
        sku: "CTSPN1",
        nombre: "TOP SEGUNDA PIEL TIRA FINA",
        vigencia: "historico",
        colores: ["NEGRO", "BLANCO"],
        foto: null,
      },
    ]);
  });

  it("un combo no aparece: no se da de alta desde acá", async () => {
    await producto("COMBO26", { searchText: "combo26 top segunda piel", isCombo: true });

    expect(await buscar("top segunda")).toEqual([]);
  });

  it("lo que ya no está en las fuentes no aparece", async () => {
    await producto("CTSPN1", { searchText: "ctspn1 top segunda piel", present: false });

    expect(await buscar("top segunda")).toEqual([]);
  });
});

describe("la API", () => {
  it("las opciones salen de la base con el dominio real", async () => {
    await guardarReferencias(REFERENCIAS, new Date());

    const respuesta = await dispatchApiRequest(new Request("http://app.local/api/v1/catalogo/alta/opciones"), {
      user: { role: "admin" },
      realDomains: ["catalogo"],
    });

    expect(((await respuesta.json()) as CatalogoAltaOpciones).proveedores.map(({ nombre }) => nombre)).toEqual([
      "BETHY",
      "EDESUR",
    ]);
  });

  it("un rol sin el área de productos no entra", async () => {
    const respuesta = await dispatchApiRequest(new Request("http://app.local/api/v1/catalogo/alta/opciones"), {
      user: { role: "solo_lectura" },
      realDomains: ["catalogo"],
    });

    expect(respuesta.status).toBe(403);
  });
});
