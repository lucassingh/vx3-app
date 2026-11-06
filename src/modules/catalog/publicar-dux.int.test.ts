import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { CatalogoAltaInput, CatalogoPasoDeDux } from "@/lib/api/contracts/catalogo";
import { ConflictError, ExternalServiceError } from "@/lib/errors";
import { getAuth } from "@/modules/platform/auth/auth";
import { tomarBloqueo } from "@/modules/platform/sync-runs";
import {
  avanzarPublicacionEnDux,
  bajarArchivoDeImportacion,
  borrarBorradorDeAlta,
  comprobarImportacionEnDux,
  guardarBorradorDeAlta,
} from "./actions";
import { escrituraEnDux, guardarReferencias } from "./alta-consultas";
import { avanzarEnDux, comprobarEnDux } from "./publicar-dux";

const dux = vi.hoisted(() => ({
  buscar: vi.fn(),
  crear: vi.fn(),
  escrituraFalla: null as Error | null,
}));
const request = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("@/integrations/dux", () => ({
  erpGateway: async () => ({ buscarItem: dux.buscar }),
  duxEscritura: async () => {
    if (dux.escrituraFalla) throw dux.escrituraFalla;
    return { crearItem: dux.crear };
  },
  sucursalesDux: () => [1, 2],
}));

const db = getDb();
const sufijo = Date.now();
const PASSWORD = "contraseña del usuario de prueba";

const INPUT = {
  sku: "HB90",
  rubro: "HOMBRE",
  subrubro: "BOXER",
  nombre: "BOXER SMART - CURVA DE TALLES M A XL - NEGRO",
  prenda: "BOXER SMART",
  color: "NEGRO",
  copa: "",
  marca: "UOMO",
  proveedorId: "7",
  tela: "",
  colores: ["NEGRO"],
  talles: "M A XL",
  atributos: {},
  opcionales: {},
  costoDocena: 48_000,
  pesoBultoKg: 0.7,
  medidasCm: [32, 18, 9],
  fotos: [{ clave: "catalogo/boxer.jpg", nombre: "boxer.jpg", ancho: 800, alto: 800 }],
} satisfies CatalogoAltaInput;

const REFERENCIAS = {
  rubros: [{ id: 1, nombre: "HOMBRE" }],
  subrubros: [{ id: 10, rubroId: 1, nombre: "BOXER" }],
  proveedores: [{ id: 7, nombre: "FABRICANTE, PRUEBA", habilitado: true }],
  listas: [
    { id: 71695, nombre: "MAYORISTA EF/TR", habilitado: true },
    { id: 71697, nombre: "LOCAL EF/TR", habilitado: true },
  ],
};

const itemDeDux = (code: string, cambios: Record<string, unknown> = {}) => ({
  id: newId(),
  code,
  normalizedCode: code,
  kind: "prenda" as const,
  baseCode: code,
  name: code,
  category: "HOMBRE",
  subcategory: "BOXER",
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

const crearBorrador = async (cambios: Partial<CatalogoAltaInput> = {}) => {
  const { id } = await db.catalogDraft.create({
    data: {
      id: newId(),
      data: { ...INPUT, ...cambios } as object,
      createdByLabel: "Prueba",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return id;
};

const pasos = async (id: string) => {
  const { steps } = await db.catalogDraft.findUniqueOrThrow({ where: { id } });
  return (steps as CatalogoPasoDeDux[] | null)?.map(({ codigo, estado }) => `${codigo} ${estado}`) ?? null;
};
const codigosCreados = () => dux.crear.mock.calls.map(([pedido]) => (pedido as { cod_item: string }).cod_item);

const limpiar = async () => {
  await db.catalogDraft.deleteMany();
  await db.duxReference.deleteMany();
  await db.duxUsedCode.deleteMany();
  await db.duxItem.deleteMany();
  await db.syncLock.deleteMany();
  await db.auditLog.deleteMany({ where: { action: { startsWith: "catalogo." } } });
};

beforeEach(async () => {
  await limpiar();
  dux.buscar.mockReset().mockResolvedValue(null);
  dux.crear.mockReset().mockResolvedValue({ status: 201, cuerpo: {} });
  dux.escrituraFalla = null;
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("DUX_ID_PERSONAL", "15401272");
  vi.stubEnv("DUX_ID_UNIDAD_MEDIDA", "3");
  vi.stubEnv("MEDIA_URL", "https://abc.public.blob.vercel-storage.com");
  await guardarReferencias(REFERENCIAS, new Date());
  await db.duxItem.create({ data: itemDeDux("HB1", { brand: "UOMO", brandCode: "UO-7" }) });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.user.deleteMany({ where: { email: { endsWith: `+pub${sufijo}@vx3.test` } } });
  await db.$disconnect();
});

describe("de a un código", () => {
  it("cada llamada crea uno, la prenda primero, con su marca, sus ID y su foto", async () => {
    const id = await crearBorrador();

    const { creado, borrador } = await avanzarEnDux(id);

    expect(creado).toMatchObject({ codigo: "HB90", precio: 8_900 });
    expect(borrador.publicacion).toMatchObject({ enDux: false });
    expect(dux.crear).toHaveBeenCalledOnce();
    expect(dux.crear.mock.calls[0]?.[0]).toMatchObject({
      cod_item: "HB90",
      tipo_producto: "SIMPLE",
      id_personal: 15401272,
      id_unidad_medida: 3,
      id_rubro: 1,
      id_sub_rubro: 10,
      id_proveedor: 7,
      cod_marca: "UO-7",
      imagen_url: "https://abc.public.blob.vercel-storage.com/catalogo/boxer.jpg",
    });
    expect(await pasos(id)).toEqual(["HB90 creado", "HB90-6 pendiente"]);
  });

  it("al terminar, queda en DUX, y otra llamada no toca nada", async () => {
    const id = await crearBorrador();

    expect((await avanzarEnDux(id)).borrador.publicacion?.enDux).toBe(false);
    expect((await avanzarEnDux(id)).borrador.publicacion?.enDux).toBe(true);

    const ultimo = await avanzarEnDux(id);

    expect(ultimo.borrador.publicacion?.enDux).toBe(true);
    expect(ultimo.creado).toBeNull();
    expect(codigosCreados()).toEqual(["HB90", "HB90-6"]);
  });

  it("los códigos creados ya cuentan como usados, sin esperar a la próxima sincronización", async () => {
    const id = await crearBorrador();

    await avanzarEnDux(id);

    expect(await db.duxUsedCode.count({ where: { code: "HB90" } })).toBe(1);
  });
});

describe("si se corta, se retoma sin duplicar", () => {
  it("DUX creó el código pero no lo confirmó: al retomar lo encuentra y no lo vuelve a crear", async () => {
    const id = await crearBorrador();
    dux.crear.mockRejectedValueOnce(
      new ExternalServiceError("DUX", "DUX no confirmó el cambio, y no se sabe si quedó hecho."),
    );

    const { borrador } = await avanzarEnDux(id);
    expect(borrador.publicacion?.pasos[0]).toMatchObject({
      estado: "error",
      detalle: expect.stringContaining("no confirmó"),
    });

    dux.buscar.mockResolvedValueOnce({
      codigo: "HB90",
      nombre: "BOXER SMART - CURVA DE TALLES M A XL - NEGRO - UNIDAD",
    });
    const retomado = await avanzarEnDux(id);

    expect(retomado.creado).toBeNull();
    expect(retomado.borrador.publicacion?.pasos[0]).toMatchObject({ estado: "creado", detalle: "Ya estaba en DUX." });
    expect(dux.crear).toHaveBeenCalledOnce();
  });

  it("si DUX lo rechazó, al retomar lo vuelve a intentar", async () => {
    const id = await crearBorrador();
    dux.crear.mockRejectedValueOnce(new ExternalServiceError("DUX", "DUX rechazó el pedido (cod_marca: no existe)."));

    await avanzarEnDux(id);
    const { creado } = await avanzarEnDux(id);

    expect(creado?.codigo).toBe("HB90");
    expect(codigosCreados()).toEqual(["HB90", "HB90"]);
  });

  it("un corte a mitad sigue por el que faltaba", async () => {
    const id = await crearBorrador();
    await avanzarEnDux(id);
    dux.crear.mockClear();

    const { creado } = await avanzarEnDux(id);

    expect(creado?.codigo).toBe("HB90-6");
    expect(codigosCreados()).toEqual(["HB90-6"]);
  });

  it("un código que ya existe con otro nombre no se pisa: lo dice y frena", async () => {
    const id = await crearBorrador();
    dux.buscar.mockResolvedValueOnce({ codigo: "HB90", nombre: "OTRO PRODUCTO" });

    const { borrador, creado } = await avanzarEnDux(id);

    expect(creado).toBeNull();
    expect(borrador.publicacion?.pasos[0]).toMatchObject({
      estado: "error",
      detalle: "Ya existe en DUX con otro nombre: OTRO PRODUCTO.",
    });
    expect(dux.crear).not.toHaveBeenCalled();
  });

  it("dos a la vez no pasan: uno espera", async () => {
    const id = await crearBorrador();
    await tomarBloqueo(`alta:${id}`, 60_000);

    await expect(avanzarEnDux(id)).rejects.toThrow("ya se está publicando");

    expect(dux.crear).not.toHaveBeenCalled();
  });

  it("no queda bloqueado después de un error", async () => {
    const id = await crearBorrador();
    dux.crear.mockRejectedValueOnce(new Error("se rompió otra cosa"));

    await expect(avanzarEnDux(id)).rejects.toThrow("se rompió otra cosa");

    await expect(avanzarEnDux(id)).resolves.toBeDefined();
  });
});

describe("el candado por ambiente", () => {
  it.each([
    ["local", undefined],
    ["qa", undefined],
    ["preview", "X-Prueba: 1"],
  ])("en %s no se escribe, y no marca nada", async (ambiente, cabecera) => {
    vi.stubEnv("APP_ENV", ambiente);
    if (cabecera) vi.stubEnv("DUX_CABECERA_DE_PRUEBA", cabecera);
    const id = await crearBorrador();

    await expect(avanzarEnDux(id)).rejects.toThrow("Fuera de producción no se escribe en DUX");

    expect(dux.crear).not.toHaveBeenCalled();
    expect(await pasos(id)).toBeNull();
    expect(escrituraEnDux().puede).toBe(false);
  });

  it("en QA, con el conjunto de datos de prueba, sí", async () => {
    vi.stubEnv("APP_ENV", "qa");
    vi.stubEnv("DUX_CABECERA_DE_PRUEBA", "X-Prueba: 1");
    const id = await crearBorrador();

    expect(escrituraEnDux()).toEqual({ puede: true, motivo: null });
    await avanzarEnDux(id);

    expect(codigosCreados()).toEqual(["HB90"]);
  });

  it("si el cliente de escritura lo frena igual, tampoco marca nada", async () => {
    dux.escrituraFalla = new ConflictError("Fuera de producción no se escribe en DUX.");
    const id = await crearBorrador();

    await expect(avanzarEnDux(id)).rejects.toThrow("Fuera de producción");

    expect(await pasos(id)).toBeNull();
  });

  it("sin la unidad de medida o la persona, lo dice antes de intentar", async () => {
    vi.stubEnv("DUX_ID_PERSONAL", "");
    const id = await crearBorrador();

    expect(escrituraEnDux().puede).toBe(false);
    await expect(avanzarEnDux(id)).rejects.toThrow("unidad de medida");

    expect(dux.crear).not.toHaveBeenCalled();
  });
});

describe("antes de empezar", () => {
  it("un borrador incompleto no llega a DUX", async () => {
    const id = await crearBorrador({ pesoBultoKg: 0 });

    await expect(avanzarEnDux(id)).rejects.toThrow("El peso del bulto es obligatorio");

    expect(dux.buscar).not.toHaveBeenCalled();
    expect(await pasos(id)).toBeNull();
  });

  it("un número ya usado no se vuelve a usar", async () => {
    await db.duxUsedCode.create({ data: { code: "HB90-6", normalizedCode: "HB90-6", firstSeenAt: new Date() } });
    const id = await crearBorrador();

    await expect(avanzarEnDux(id)).rejects.toThrow("Ese número ya se usó");
  });

  it("un subrubro que ya no está en DUX frena", async () => {
    const id = await crearBorrador({ subrubro: "OTRO" });

    await expect(avanzarEnDux(id)).rejects.toThrow("no existe en DUX");
  });

  it("una marca sin código frena: sin él, DUX la rechazaría", async () => {
    const id = await crearBorrador({ marca: "SIN CODIGO" });

    await expect(avanzarEnDux(id)).rejects.toThrow("Falta el código de la marca SIN CODIGO");

    expect(dux.crear).not.toHaveBeenCalled();
  });

  it("sin marca ni foto, igual se puede publicar", async () => {
    const id = await crearBorrador({ marca: "", fotos: [] });

    await avanzarEnDux(id);

    const pedido = dux.crear.mock.calls[0]?.[0] as object;
    expect(pedido).not.toHaveProperty("cod_marca");
    expect(pedido).not.toHaveProperty("imagen_url");
  });

  it("retomar no vuelve a validar los usados: el código propio ya está entre ellos", async () => {
    const id = await crearBorrador();
    await avanzarEnDux(id);

    const { creado } = await avanzarEnDux(id);

    expect(creado?.codigo).toBe("HB90-6");
  });
});

describe("comprobar lo importado a mano", () => {
  const conLos = (...codigos: string[]) =>
    dux.buscar.mockImplementation(async (codigo: string) =>
      codigos.includes(codigo)
        ? {
            codigo,
            nombre: `BOXER SMART - CURVA DE TALLES M A XL - NEGRO - ${codigo.endsWith("-6") ? "MEDIA DOCENA" : "UNIDAD"}`,
          }
        : null,
    );

  it("solo lee: marca lo que está y dice lo que falta", async () => {
    conLos("HB90");
    const id = await crearBorrador();

    const { publicacion } = await comprobarEnDux(id);

    expect(publicacion).toMatchObject({
      enDux: false,
      pasos: [
        { codigo: "HB90", estado: "creado", detalle: "Importado a mano." },
        { codigo: "HB90-6", estado: "pendiente", detalle: "Todavía no está en DUX." },
      ],
    });
    expect(dux.crear).not.toHaveBeenCalled();
  });

  it("con todo importado, queda en DUX", async () => {
    conLos("HB90", "HB90-6");
    const id = await crearBorrador();

    expect((await comprobarEnDux(id)).publicacion?.enDux).toBe(true);
  });

  it("funciona en cualquier ambiente: leer no tiene candado", async () => {
    vi.stubEnv("APP_ENV", "qa");
    conLos("HB90", "HB90-6");
    const id = await crearBorrador();

    expect((await comprobarEnDux(id)).publicacion?.enDux).toBe(true);
  });

  it("un código con otro nombre no cuenta", async () => {
    dux.buscar.mockResolvedValue({ codigo: "HB90", nombre: "OTRO" });
    const id = await crearBorrador();

    const { publicacion } = await comprobarEnDux(id);

    expect(publicacion?.pasos[0]).toMatchObject({ estado: "error" });
    expect(publicacion?.enDux).toBe(false);
  });
});

describe("desde la pantalla", () => {
  const entrar = async (rol: "compras" | "marketing") => {
    const email = `${rol}+pub${sufijo}@vx3.test`;
    await getAuth().api.createUser({
      body: { email, name: `Prueba ${rol}`, password: PASSWORD, role: rol, data: { mustChangePassword: false } },
    });
    const { headers } = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });
    const cookie = /((?:__Secure-)?vx3\.session_token=[^;]+)/.exec(headers.get("set-cookie") ?? "")?.[1];
    if (!cookie) throw new Error("No vino la cookie de sesión");
    return new Headers({ cookie });
  };

  let compras = new Headers();
  let marketing = new Headers();

  beforeAll(async () => {
    compras = await entrar("compras");
    marketing = await entrar("marketing");
  });

  beforeEach(() => {
    request.headers = compras;
  });

  it("cada código creado queda registrado, con su precio", async () => {
    const id = await crearBorrador();

    const resultado = await avanzarPublicacionEnDux({ id });

    expect(resultado).toMatchObject({ ok: true });
    const auditoria = await db.auditLog.findFirstOrThrow({ where: { action: "catalogo.dux_item" } });
    expect(auditoria).toMatchObject({ entityId: "HB90" });
    expect(auditoria.after).toMatchObject({ codigo: "HB90", precio: 8_900 });
  });

  it("un rol que solo ve el catálogo no publica, no comprueba ni baja los archivos", async () => {
    const id = await crearBorrador();
    request.headers = marketing;
    const prohibido = { ok: false, error: { code: "FORBIDDEN" } };

    expect(await avanzarPublicacionEnDux({ id })).toMatchObject(prohibido);
    expect(await comprobarImportacionEnDux({ id })).toMatchObject(prohibido);
    expect(await bajarArchivoDeImportacion({ id, archivo: "1_productos" })).toMatchObject(prohibido);
    expect(dux.crear).not.toHaveBeenCalled();
  });

  it("los .xls salen del borrador guardado, con el proveedor y las listas de DUX, y queda registrado", async () => {
    const id = await crearBorrador();

    const resultado = await bajarArchivoDeImportacion({ id, archivo: "3_precios" });

    if (!resultado.ok) throw new Error(resultado.error.message);
    expect(resultado.data.nombre).toBe("3_precios.xls");
    const archivo = Buffer.from(resultado.data.base64, "base64");
    expect(archivo.subarray(0, 8).toString("hex")).toBe("d0cf11e0a1b11ae1");
    expect(archivo.toString("latin1")).toContain("MAYORISTA EF/TR (ID. 71695)");
    expect(await db.auditLog.count({ where: { action: "catalogo.bajo_xls", entityId: id } })).toBe(1);
  });

  it("un borrador incompleto no baja archivos", async () => {
    const id = await crearBorrador({ colores: [] });

    expect(await bajarArchivoDeImportacion({ id, archivo: "1_productos" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
  });

  it("con un código en DUX, el borrador ya no se cambia ni se borra", async () => {
    const id = await crearBorrador();
    await avanzarEnDux(id);

    const conflicto = { ok: false, error: { code: "CONFLICT" } };
    expect(await guardarBorradorDeAlta({ id, input: { ...INPUT, prenda: "OTRA" } })).toMatchObject(conflicto);
    expect(await borrarBorradorDeAlta({ id })).toMatchObject(conflicto);
    expect(await db.catalogDraft.count()).toBe(1);
  });

  it("si DUX lo rechazó antes de crear nada, se corrige y empieza de nuevo", async () => {
    const id = await crearBorrador();
    dux.crear.mockRejectedValueOnce(new ExternalServiceError("DUX", "DUX rechazó el pedido."));
    await avanzarEnDux(id);
    expect(await pasos(id)).toEqual(["HB90 error", "HB90-6 pendiente"]);

    expect(await guardarBorradorDeAlta({ id, input: { ...INPUT, prenda: "CORREGIDA" } })).toMatchObject({
      ok: true,
      data: { publicacion: null },
    });

    expect(await pasos(id)).toBeNull();
  });
});
