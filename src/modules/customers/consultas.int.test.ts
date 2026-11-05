import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import { API_PREFIX } from "@/lib/api/domains";
import type { ClientaFila, FichaClienta, Paginated, SegmentoResumen } from "@/lib/api/types";
import type { DuxItemKind } from "@/generated/prisma/client";
import { businessTime } from "@/lib/dates";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import type { Role } from "@/modules/platform/permissions";
import {
  clientasUnificadas,
  coberturaDeClientas,
  fichaDeClienta,
  listarClientas,
  segmentosDeClientas,
} from "./consultas";
import { guardarClientas } from "./espejo-clientas";
import { recalcularClientas } from "./fichas";

const db = getDb();
const AHORA = new Date();
const HOY = businessTime.today(AHORA);
const hace = (dias: number) => businessTime.addDays(HOY, -dias);
const LOCAL = 2;
const ECOMMERCE = 1;

const clienta = (id: number, cambios: Partial<ErpClienta> = {}): ErpClienta => ({
  id,
  nombre: `Clienta ${id}`,
  nombrePila: null,
  telefono: `11440000${String(id).padStart(2, "0")}`,
  email: null,
  provincia: "Buenos Aires",
  localidad: "Temperley",
  habilitada: true,
  creadaEl: "2026-01-15",
  ...cambios,
});

type Linea = { code?: string; kind?: DuxItemKind; baseCode?: string; name?: string };

let serie = 0;
/** Un comprobante de $100, con costo de $75 por línea. */
async function compra(
  customerDuxId: number | null,
  fecha: string,
  cambios: { sucursal?: number; total?: bigint; cancelled?: boolean; numero?: number | null; lineas?: Linea[] } = {},
) {
  serie += 1;
  const lineas = cambios.lineas ?? [{}];
  await db.duxInvoice.create({
    data: {
      id: newId(),
      duxId: serie,
      branchId: cambios.sucursal ?? ECOMMERCE,
      type: "COMPROBANTE_VENTA",
      letter: "X",
      pointOfSale: "2",
      number: cambios.numero === undefined ? serie : cambios.numero,
      issuedOn: new Date(`${fecha}T00:00:00Z`),
      customerDuxId,
      totalCents: cambios.total ?? 10_000n,
      cancelled: cambios.cancelled ?? false,
      contentHash: "x",
      firstSeenAt: AHORA,
      changedAt: AHORA,
      items: {
        create: lineas.map((linea, posicion) => ({
          id: newId(),
          line: posicion,
          code: linea.code ?? "LN25",
          kind: linea.kind ?? "prenda",
          baseCode: linea.baseCode ?? linea.code ?? "LN25",
          name: linea.name ?? "Prenda",
          quantity: "1",
          unitPriceCents: 10_000n,
          discountPct: "0",
          vatPct: "0",
          costCents: 7_500n,
        })),
      },
    },
  });
}

const limpiar = async () => {
  await db.customer.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxCustomer.deleteMany();
};

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  vi.stubEnv("DUX_ID_SUCURSAL_LOCAL", String(LOCAL));
  await limpiar();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("listarClientas", () => {
  async function cinco() {
    await guardarClientas(
      [
        clienta(1, { nombre: "María Núñez", localidad: "Lanús" }),
        clienta(2, { nombre: "Johana Quiroga", localidad: "Mendoza", provincia: "Mendoza" }),
        clienta(3, { nombre: "Sin Compras" }),
        clienta(4, { nombre: "Dormida Vieja" }),
        clienta(5, { nombre: "En Riesgo" }),
      ],
      AHORA,
    );
    await compra(1, hace(5), { total: 90_000n });
    await compra(2, hace(10), { total: 50_000n });
    await compra(4, hace(200), { total: 30_000n });
    await compra(5, hace(90), { total: 20_000n });
    await recalcularClientas(AHORA);
  }

  it("ordena por lo que compró, con las que no compraron al final", async () => {
    await cinco();

    const { data, total } = await listarClientas({});

    expect(total).toBe(5);
    expect(data.map(({ nombre }) => nombre)).toEqual([
      "María Núñez",
      "Johana Quiroga",
      "Dormida Vieja",
      "En Riesgo",
      "Sin Compras",
    ]);
  });

  it("arma la fila con el contrato, en pesos", async () => {
    await cinco();

    const { data } = await listarClientas({ q: "Quiroga" });

    expect(data[0]).toMatchObject({
      nombre: "Johana Quiroga",
      localidad: "Mendoza",
      provincia: "Mendoza",
      zona: null,
      segmento: "nueva",
      origen: "sin_dato",
      origenLabel: "Sin dato",
      pedidos: 1,
      totalComprado: 500,
      margen: 25,
      ultimaCompraDias: 10,
      cicloDias: null,
    });
  });

  it("una sin compras no tiene segmento ni última compra", async () => {
    await cinco();

    const { data } = await listarClientas({ q: "sin compras" });

    expect(data[0]).toMatchObject({ segmento: null, ultimaCompraDias: null, pedidos: 0, totalComprado: 0 });
  });

  it("filtra por segmento", async () => {
    await cinco();

    expect((await listarClientas({ segmento: "dormida" })).data.map(({ nombre }) => nombre)).toEqual(["Dormida Vieja"]);
    expect((await listarClientas({ segmento: "en_riesgo" })).total).toBe(1);
    expect((await listarClientas({ segmento: "activa" })).data).toEqual([]);
  });

  it("busca por nombre y localidad, sin mirar tildes ni mayúsculas", async () => {
    await cinco();

    const nombres = async (q: string) => (await listarClientas({ q })).data.map(({ nombre }) => nombre);
    expect(await nombres("maria nunez")).toEqual(["María Núñez"]);
    expect(await nombres("LANUS")).toEqual(["María Núñez"]);
    expect(await nombres("no existe")).toEqual([]);
  });

  it("busca por teléfono, escrito de cualquier forma", async () => {
    await cinco();

    const nombres = async (q: string) => (await listarClientas({ q })).data.map(({ nombre }) => nombre);
    expect(await nombres("1144000002")).toEqual(["Johana Quiroga"]);
    expect(await nombres("+54 9 11 4400-0002")).toEqual(["Johana Quiroga"]);
    expect((await listarClientas({ q: "12" })).total).toBe(0);
  });

  it("combina el filtro con la búsqueda", async () => {
    await cinco();

    expect((await listarClientas({ q: "Quiroga", segmento: "dormida" })).total).toBe(0);
    expect((await listarClientas({ q: "Quiroga", segmento: "nueva" })).total).toBe(1);
  });

  it("pagina, y una página fuera de rango va a la última", async () => {
    await cinco();

    const segunda = await listarClientas({ page: 2, pageSize: 2 });
    expect(segunda).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(segunda.data.map(({ nombre }) => nombre)).toEqual(["Dormida Vieja", "En Riesgo"]);

    const fuera = await listarClientas({ page: 99, pageSize: 2 });
    expect(fuera.page).toBe(3);
    expect(fuera.data.map(({ nombre }) => nombre)).toEqual(["Sin Compras"]);
  });

  it("sin clientas, una página vacía", async () => {
    expect(await listarClientas({})).toEqual({ data: [], page: 1, pageSize: 8, total: 0, totalPages: 1 });
  });
});

describe("segmentosDeClientas", () => {
  it("cuenta las clientas y su parte del margen, con los cinco segmentos siempre", async () => {
    await guardarClientas([clienta(1), clienta(2), clienta(3), clienta(4)], AHORA);
    await compra(1, hace(200), { lineas: [{}, { code: "VN16" }, { code: "CAN9" }] });
    await compra(2, hace(10));
    await compra(3, hace(11));
    await recalcularClientas(AHORA);

    const resumen = await segmentosDeClientas();

    expect(resumen.map(({ segmento }) => segmento)).toEqual(["nueva", "activa", "top", "en_riesgo", "dormida"]);
    const de = (segmento: SegmentoResumen["segmento"]) => resumen.find((item) => item.segmento === segmento);
    expect(de("dormida")).toMatchObject({ clientas: 1, margen: 75, participacion: 0.6 });
    expect(de("nueva")).toMatchObject({ clientas: 2, margen: 50, participacion: 0.4 });
    expect(de("activa")).toMatchObject({ clientas: 0, margen: 0, participacion: 0 });
  });

  it("sin clientas, todo en cero", async () => {
    expect((await segmentosDeClientas()).every(({ participacion }) => participacion === 0)).toBe(true);
  });
});

describe("coberturaDeClientas", () => {
  it("dice qué parte de la venta tiene una clienta identificada", async () => {
    await guardarClientas([clienta(1), clienta(2, { telefono: null }), clienta(3)], AHORA);
    await compra(1, hace(5), { total: 30_000n });
    await compra(2, hace(5), { total: 60_000n, sucursal: LOCAL });
    await compra(null, hace(5), { total: 10_000n });
    await recalcularClientas(AHORA);

    expect(await coberturaDeClientas()).toEqual({ ventaIdentificada: 0.3, sinCompras: 1 });
  });

  it("no cuenta anuladas ni lo anterior a los 12 meses", async () => {
    await guardarClientas([clienta(1), clienta(2, { telefono: null })], AHORA);
    await compra(1, hace(5), { total: 10_000n });
    await compra(1, hace(400), { total: 90_000n });
    await compra(2, hace(5), { total: 10_000n });
    await compra(2, hace(5), { total: 90_000n, cancelled: true });
    await recalcularClientas(AHORA);

    expect((await coberturaDeClientas()).ventaIdentificada).toBe(0.5);
  });

  it("sin ventas, cero", async () => {
    expect(await coberturaDeClientas()).toEqual({ ventaIdentificada: 0, sinCompras: 0 });
  });
});

describe("fichaDeClienta", () => {
  it("no encuentra un ID que no existe", async () => {
    expect(await fichaDeClienta(newId())).toBeNull();
  });

  it("junta las compras de sus dos fichas, y los totales cierran con sus comprobantes", async () => {
    await guardarClientas(
      [
        clienta(1, { nombre: "Vieja", telefono: "+5491144445555" }),
        clienta(2, { nombre: "Vigente", telefono: "11-44445555" }),
      ],
      AHORA,
    );
    await compra(1, hace(60), { total: 40_000n, sucursal: LOCAL });
    await compra(2, hace(30), { total: 20_000n });
    await compra(2, hace(30), { total: 10_000n });
    await compra(2, hace(40), { total: 90_000n, cancelled: true });
    await recalcularClientas(AHORA);
    const { id } = await db.customer.findFirstOrThrow();

    const ficha = (await fichaDeClienta(id)) as FichaClienta;

    expect(ficha).toMatchObject({
      nombre: "Vigente",
      pedidos: 2,
      totalComprado: 700,
      ticketPromedio: 350,
      primeraCompraDias: 60,
      ultimaCompraDias: 30,
      cicloDias: 30,
      telefonoNormalizado: "1144445555",
      origen: "local",
      origenLabel: "Local",
      cp: null,
      anuncioOrigen: null,
    });
    expect(ficha.eventos).toHaveLength(3);
    expect(ficha.eventos.reduce((suma, { monto }) => suma + (monto ?? 0), 0)).toBe(ficha.totalComprado);
    expect(ficha.identidades.map(({ detalle }) => detalle)).toEqual([
      "Vieja · 1 comprobante",
      "Vigente · 2 comprobantes",
    ]);
  });

  it("los comprobantes van del más nuevo al más viejo, con su canal y sus productos", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await compra(1, hace(60), { sucursal: LOCAL, numero: 123, lineas: [{ code: "LN25" }, { code: "VN16" }] });
    await compra(1, hace(5), { numero: null, lineas: [{ code: "ENVIO1", kind: "no_producto" }] });
    await recalcularClientas(AHORA);
    const { id } = await db.customer.findFirstOrThrow();

    const { eventos } = (await fichaDeClienta(id)) as FichaClienta;

    expect(eventos.map(({ titulo, detalle }) => [titulo, detalle])).toEqual([
      ["Comprobante sin número", "E-commerce"],
      ["Comprobante X 2-00000123", "Local · LN25, VN16"],
    ]);
    expect(eventos[1]?.fecha).toBe(businessTime.startOfDay(hace(60)).toISOString());
  });

  it("dice qué trae con frecuencia: por producto y por día, sin lo que no es mercadería", async () => {
    await guardarClientas([clienta(1)], AHORA);
    const linea = (baseCode: string, code = baseCode, name = `Producto ${baseCode}`) => ({ baseCode, code, name });
    const envio = { code: "ENVIO1", kind: "no_producto" as const };
    await compra(1, hace(30), { lineas: [linea("LN25", "LN25-6", "Nombre viejo"), linea("VN16"), envio] });
    await compra(1, hace(20), { lineas: [linea("LN25", "LN25-12", "Nombre nuevo"), envio] });
    await compra(1, hace(20), { lineas: [linea("LN25", "LN25-6", "Nombre nuevo")] });
    await compra(1, hace(10), { lineas: [linea("A"), linea("B"), linea("C"), linea("D")] });
    await recalcularClientas(AHORA);
    const { id } = await db.customer.findFirstOrThrow();

    const { skusFrecuentes } = (await fichaDeClienta(id)) as FichaClienta;

    expect(skusFrecuentes).toHaveLength(4);
    expect(skusFrecuentes[0]).toEqual({ sku: "LN25", nombre: "Nombre nuevo", colores: [], veces: 2 });
    expect(skusFrecuentes.map(({ sku }) => sku)).not.toContain("ENVIO1");
  });

  it("una sin compras muestra la ficha vacía", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await recalcularClientas(AHORA);
    const { id } = await db.customer.findFirstOrThrow();

    expect(await fichaDeClienta(id)).toMatchObject({
      segmento: null,
      pedidos: 0,
      ticketPromedio: 0,
      primeraCompraDias: null,
      ultimaCompraDias: null,
      eventos: [],
      skusFrecuentes: [],
    });
  });
});

describe("clientasUnificadas", () => {
  it("lista solo a las que tienen más de una ficha, con los comprobantes de cada una", async () => {
    await guardarClientas(
      [
        clienta(1, { nombre: "Johana Quiroga", telefono: "011 3398-7712" }),
        clienta(2, { nombre: "Johanna Quiroga", telefono: "5491133987712" }),
        clienta(3),
      ],
      AHORA,
    );
    await compra(1, hace(5));
    await compra(1, hace(6));
    await compra(2, hace(7));
    await compra(2, hace(8), { cancelled: true });
    await recalcularClientas(AHORA);

    const unificadas = await clientasUnificadas();

    expect(unificadas).toHaveLength(1);
    expect(unificadas[0]).toMatchObject({
      nombre: "Johana Quiroga",
      telefonoNormalizado: "1133987712",
      motivo: "2 fichas de DUX con el mismo teléfono",
      registros: [
        { sistema: "DUX", nombre: "Johana Quiroga", detalle: "Teléfono 011 3398-7712 · 2 comprobantes" },
        { sistema: "DUX", nombre: "Johanna Quiroga", detalle: "Teléfono 5491133987712 · 1 comprobante" },
      ],
    });
    expect(unificadas[0]?.clientaId).toBe(unificadas[0]?.id);
  });

  it("sin unificadas, una lista vacía", async () => {
    await guardarClientas([clienta(1)], AHORA);
    await recalcularClientas(AHORA);

    expect(await clientasUnificadas()).toEqual([]);
  });
});

describe("la API de clientas", () => {
  const pedir = (ruta: string, role: Role = "admin") =>
    dispatchApiRequest(new Request(`http://app.local${API_PREFIX}${ruta}`), {
      user: { role },
      realDomains: ["clientas"],
    });

  beforeEach(async () => {
    await guardarClientas([clienta(1, { nombre: "De la base" })], AHORA);
    await compra(1, hace(5));
    await recalcularClientas(AHORA);
  });

  it("lee de la base, con filtro y paginación por la URL", async () => {
    const { data, total } = (await (
      await pedir("/clientas?q=base&page=1&pageSize=5")
    ).json()) as Paginated<ClientaFila>;

    expect(total).toBe(1);
    expect(data[0]?.nombre).toBe("De la base");
    expect((await (await pedir("/clientas?segmento=dormida")).json()).total).toBe(0);
    // Un segmento que no existe no filtra, igual que en la maqueta.
    expect((await (await pedir("/clientas?segmento=otro")).json()).total).toBe(1);
  });

  it("abre la ficha por ID, y uno que no existe da 404", async () => {
    const { id } = await db.customer.findFirstOrThrow();

    expect((await pedir(`/clientas/${id}`)).status).toBe(200);
    expect((await pedir(`/clientas/${newId()}`)).status).toBe(404);
  });

  it("un ID de las pantallas simuladas sigue en la API simulada", async () => {
    expect((await pedir("/clientas/c-10")).status).toBe(200);
  });

  it.each<[Role, number]>([
    ["admin", 200],
    ["operaciones", 200],
    ["postventa", 200],
    ["marketing", 200],
    ["compras", 403],
    ["solo_lectura", 403],
  ])("%s pide las fichas y recibe %i", async (role, status) => {
    expect((await pedir("/clientas", role)).status).toBe(status);
    expect((await pedir("/clientas/duplicados", role)).status).toBe(status);
    expect((await pedir("/clientas/cobertura", role)).status).toBe(status);
  });

  it("sin sesión, 401", async () => {
    const respuesta = await dispatchApiRequest(new Request(`http://app.local${API_PREFIX}/clientas`), {
      user: null,
      realDomains: ["clientas"],
    });

    expect(respuesta.status).toBe(401);
  });
});
