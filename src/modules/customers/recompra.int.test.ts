import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { DuxItemKind } from "@/generated/prisma/client";
import { dispatchApiRequest } from "@/lib/api/dispatch";
import { API_PREFIX } from "@/lib/api/domains";
import { businessTime } from "@/lib/dates";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import type { Role } from "@/modules/platform/permissions";
import { guardarClientas } from "./espejo-clientas";
import { recalcularClientas } from "./fichas";
import { listaDeRecompra, marcarRecompra, RecompraNoCorresponde, resultadosDeRecompra } from "./recompra";

const db = getDb();
const AHORA = new Date();
const HOY = businessTime.today(AHORA);
const hace = (dias: number) => businessTime.addDays(HOY, -dias);
const dentroDe = (dias: number) => businessTime.addDays(HOY, dias);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00Z`);

const clienta = (id: number, cambios: Partial<ErpClienta> = {}): ErpClienta => ({
  id,
  nombre: `Clienta ${id}`,
  nombrePila: `Nombre${id}`,
  telefono: `1144${String(id).padStart(6, "0")}`,
  email: null,
  provincia: "Buenos Aires",
  localidad: "Temperley",
  habilitada: true,
  creadaEl: "2025-01-15",
  ...cambios,
});

let serie = 0;
/** Un comprobante de una línea. Más precio y más margen, más arriba en la lista. */
async function compra(
  customerDuxId: number,
  fecha: string,
  { precio = 10_000n, codigo = "LN25", cantidad = "1", nombre = "Prenda" } = {},
) {
  serie += 1;
  await db.duxInvoice.create({
    data: {
      id: newId(),
      duxId: serie,
      branchId: 1,
      type: "COMPROBANTE_VENTA",
      letter: "X",
      pointOfSale: "2",
      number: serie,
      issuedOn: aFecha(fecha),
      customerDuxId,
      totalCents: precio,
      cancelled: false,
      contentHash: "x",
      firstSeenAt: AHORA,
      changedAt: AHORA,
      items: {
        create: {
          id: newId(),
          line: 0,
          code: codigo,
          kind: "prenda",
          baseCode: codigo,
          name: nombre,
          quantity: cantidad,
          unitPriceCents: precio,
          discountPct: "0",
          vatPct: "0",
          costCents: (precio * 3n) / 4n,
        },
      },
    },
  });
}

async function producto(
  codigo: string,
  {
    rubro = "LESS",
    subrubro = null as string | null,
    stock = "100",
    alta = "2025-01-01",
    tipo = "prenda" as DuxItemKind,
    nombre = `PRODUCTO ${codigo} - UNIDAD`,
  } = {},
) {
  await db.duxItem.create({
    data: {
      id: newId(),
      code: codigo,
      normalizedCode: codigo,
      kind: tipo,
      baseCode: codigo,
      name: nombre,
      category: rubro,
      subcategory: subrubro,
      costCents: 100n,
      prices: [],
      stockReal: stock,
      stockReserved: "0",
      stockAvailable: stock,
      enabled: true,
      createdOn: aFecha(alta),
      contentHash: "x",
      firstSeenAt: AHORA,
      lastSeenAt: AHORA,
      changedAt: AHORA,
    },
  });
}

/** Una clienta con una compra, recalculada y lista para la secuencia. */
async function unaClienta(fecha = hace(7), datos: Partial<ErpClienta> = {}) {
  await guardarClientas([clienta(1, datos)], AHORA);
  await compra(1, fecha);
  await recalcularClientas(AHORA);
  return (await db.customer.findFirstOrThrow()).id;
}

const limpiar = async () => {
  await db.customer.deleteMany();
  await db.duxInvoice.deleteMany();
  await db.duxCustomer.deleteMany();
  await db.duxItem.deleteMany();
};

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("CREDENTIALS_KEY", "A".repeat(43));
  await limpiar();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpiar();
  await db.$disconnect();
});

describe("la lista del día", () => {
  it("hasta 30, primero las de más margen, y dice cuántas esperan lugar", async () => {
    const ids = Array.from({ length: 33 }, (_, indice) => indice + 1);
    await guardarClientas(
      ids.map((id) => clienta(id)),
      AHORA,
    );
    await Promise.all(ids.map((id) => compra(id, hace(8), { precio: BigInt(id) * 10_000n })));
    await recalcularClientas(AHORA);

    const { hoy, enCola, tope } = await listaDeRecompra(HOY);

    expect(tope).toBe(30);
    expect(hoy).toHaveLength(30);
    expect(enCola).toBe(3);
    expect(hoy[0]?.nombre).toBe("Clienta 33");
    expect(hoy.at(-1)?.nombre).toBe("Clienta 4");
  });

  it("no entra quien compró hace menos de una semana, ni quien nunca compró", async () => {
    await guardarClientas([clienta(1), clienta(2), clienta(3)], AHORA);
    await compra(1, hace(6));
    await compra(2, hace(7));
    await recalcularClientas(AHORA);

    const { hoy } = await listaDeRecompra(HOY);

    expect(hoy.map(({ nombre }) => nombre)).toEqual(["Clienta 2"]);
  });

  it("arma el item con su etapa, el teléfono para wa.me y su última compra", async () => {
    await unaClienta(hace(8), { nombrePila: "MARIA", telefono: "+54 9 11 4400-0001" });

    const [item] = (await listaDeRecompra(HOY)).hoy;

    expect(item).toMatchObject({
      tipo: "recompra",
      etapa: "m1",
      etapaLabel: "Mensaje 1 · cuidado",
      motivo: "Compró hace 8 días · rotación lenta",
      telefonoWa: "5491144000001",
      estado: "pendiente",
      ultimaCompraDias: 8,
      totalComprado: 100,
    });
    expect(item?.mensaje).toMatch(/Maria/);
    expect(item?.nota).toBeUndefined();
    expect(item?.ultimoPedido?.haceDias).toBe(8);
    expect(item?.skus[0]?.sku).toBe("LN25");
  });

  it("sin nombre de pila lo marca, y el mensaje no se puede mandar así", async () => {
    await unaClienta(hace(8), { nombrePila: null });

    const [item] = (await listaDeRecompra(HOY)).hoy;

    expect(item?.nota).toMatch(/nombre de pila/);
    expect(item?.mensaje).toMatch(/\[nombre\]|\[Nombre\]/);
  });

  it("es la misma durante el día: lo marcado sigue ahí y ocupa su lugar", async () => {
    const ids = Array.from({ length: 31 }, (_, indice) => indice + 1);
    await guardarClientas(
      ids.map((id) => clienta(id)),
      AHORA,
    );
    await Promise.all(ids.map((id) => compra(id, hace(8), { precio: BigInt(id) * 10_000n })));
    await recalcularClientas(AHORA);
    const antes = await listaDeRecompra(HOY);

    await marcarRecompra(antes.hoy[3]?.id ?? "", { estado: "contactada", mensaje: "Editado a mano" }, null, HOY);
    const despues = await listaDeRecompra(HOY);

    expect(despues.hoy.map(({ id }) => id)).toEqual(antes.hoy.map(({ id }) => id));
    expect(despues.hoy[3]).toMatchObject({ estado: "contactada", mensaje: "Editado a mano" });
    expect(despues.enCola).toBe(1);
  });

  it("el mensaje no cambia al recargar", async () => {
    await unaClienta();

    const primera = await listaDeRecompra(HOY);

    expect((await listaDeRecompra(HOY)).hoy[0]?.mensaje).toBe(primera.hoy[0]?.mensaje);
  });
});

describe("lo que se hace con ella", () => {
  it("una contactada no vuelve antes de una semana, y mientras tanto espera respuesta", async () => {
    const id = await unaClienta(hace(8));
    await marcarRecompra(id, { estado: "contactada" }, "usuario-1", HOY);

    const seisDias = await listaDeRecompra(dentroDe(6));
    expect(seisDias.hoy).toEqual([]);
    expect(seisDias.esperando).toMatchObject([
      { id, etapaLabel: "Mensaje 1 · cuidado", contactadaHaceDias: 6, estado: "contactada" },
    ]);

    const fila = await db.reactivationContact.findFirstOrThrow();
    expect(fila).toMatchObject({ stage: "m1", status: "contactada", actorId: "usuario-1" });
    expect(fila.variant).toMatch(/^[abc]$/);
    expect(fila.message.length).toBeGreaterThan(10);

    expect((await listaDeRecompra(dentroDe(14))).hoy[0]?.etapa).toBe("m2");
  });

  it("si responde, sale de la secuencia, aunque lo marque días después", async () => {
    const id = await unaClienta(hace(8));
    await marcarRecompra(id, { estado: "contactada" }, null, HOY);

    await marcarRecompra(id, { estado: "respondio" }, null, dentroDe(3));

    expect((await db.reactivationContact.findFirstOrThrow()).respondedOn).toEqual(aFecha(dentroDe(3)));
    expect((await listaDeRecompra(dentroDe(4))).esperando[0]?.estado).toBe("respondio");
    expect((await listaDeRecompra(dentroDe(60))).hoy).toEqual([]);
  });

  it("si respondió antes de que le escribieran, también sale", async () => {
    const id = await unaClienta(hace(8));

    await marcarRecompra(id, { estado: "respondio" }, null, HOY);

    expect((await db.reactivationContact.findFirstOrThrow()).status).toBe("respondio");
    expect((await listaDeRecompra(dentroDe(30))).hoy).toEqual([]);
  });

  it("deshacer la respuesta la vuelve a poner en la secuencia", async () => {
    const id = await unaClienta(hace(8));
    await marcarRecompra(id, { estado: "contactada" }, null, HOY);
    await marcarRecompra(id, { estado: "respondio" }, null, dentroDe(1));

    await marcarRecompra(id, { estado: "contactada" }, null, dentroDe(1));

    expect(await db.reactivationContact.findFirstOrThrow()).toMatchObject({
      status: "contactada",
      respondedOn: null,
    });
  });

  it("volver a pendiente borra lo de hoy, y le puede tocar de nuevo", async () => {
    const id = await unaClienta(hace(8));
    await marcarRecompra(id, { estado: "contactada" }, null, HOY);

    await marcarRecompra(id, { estado: "pendiente" }, null, HOY);

    expect(await db.reactivationContact.count()).toBe(0);
    expect((await listaDeRecompra(HOY)).hoy[0]?.estado).toBe("pendiente");
  });

  it("pospuesta sigue hoy en pantalla, y mañana vuelve como pendiente", async () => {
    const id = await unaClienta(hace(8));

    await marcarRecompra(id, { estado: "pospuesta" }, null, HOY);

    expect((await listaDeRecompra(HOY)).hoy[0]?.estado).toBe("pospuesta");
    expect((await listaDeRecompra(dentroDe(1))).hoy[0]).toMatchObject({ id, estado: "pendiente", etapa: "m1" });
  });

  it("si vuelve a comprar, arranca de nuevo y no repite la variante", async () => {
    const id = await unaClienta(hace(30));
    await db.reactivationContact.create({
      data: {
        id: newId(),
        customerId: id,
        contactedOn: aFecha(hace(20)),
        stage: "m1",
        variant: "a",
        status: "contactada",
        message: "x",
        createdAt: AHORA,
        updatedAt: AHORA,
      },
    });
    await compra(1, hace(7));
    await recalcularClientas(AHORA);

    const [item] = (await listaDeRecompra(HOY)).hoy;
    await marcarRecompra(id, { estado: "contactada" }, null, HOY);

    expect(item?.etapa).toBe("m1");
    const nueva = await db.reactivationContact.findFirstOrThrow({ where: { contactedOn: aFecha(HOY) } });
    expect(nueva.variant).not.toBe("a");
  });

  it("después de la despedida descansa 45 días y pasa a la reactivación", async () => {
    const id = await unaClienta(hace(60));
    await db.reactivationContact.create({
      data: {
        id: newId(),
        customerId: id,
        contactedOn: aFecha(hace(8)),
        stage: "m4",
        variant: "a",
        status: "contactada",
        message: "x",
        createdAt: AHORA,
        updatedAt: AHORA,
      },
    });

    expect((await listaDeRecompra(HOY)).hoy).toEqual([]);
    expect((await listaDeRecompra(dentroDe(37))).hoy[0]).toMatchObject({ tipo: "reactivacion" });
  });

  it("la dormida de más margen recibe el mensaje personal, y las demás el de reactivación", async () => {
    const ids = Array.from({ length: 12 }, (_, indice) => indice + 1);
    await guardarClientas(
      ids.map((id) => clienta(id)),
      AHORA,
    );
    for (const id of ids) await compra(id, hace(200), { precio: BigInt(id) * 10_000n });
    await recalcularClientas(AHORA);

    const { hoy } = await listaDeRecompra(HOY);

    expect(hoy.map(({ etapa }) => etapa)).toEqual([
      "alto_valor",
      "alto_valor",
      "alto_valor",
      ...Array.from({ length: 9 }, () => "reactivacion"),
    ]);
    expect(hoy[0]?.mensaje).toMatch(/Soy Elias/);
  });

  it("no deja marcar a quien hoy no le toca nada", async () => {
    const id = await unaClienta(hace(3));

    await expect(marcarRecompra(id, { estado: "contactada" }, null, HOY)).rejects.toBeInstanceOf(RecompraNoCorresponde);
    expect(await db.reactivationContact.count()).toBe(0);
  });

  it("una clienta que no existe da null", async () => {
    expect(await marcarRecompra(newId(), { estado: "contactada" }, null, HOY)).toBeNull();
  });
});

describe("los mensajes solo ofrecen lo que hay (RN-75)", () => {
  /** Otra clienta compra, para que haya algo vendido esta semana. */
  async function ventaDeLaSemana(codigo: string, fecha = hace(2)) {
    await guardarClientas([clienta(9)], AHORA);
    await compra(9, fecha, { codigo });
  }

  it("la categoría es lo más vendido de la semana con un bulto en stock", async () => {
    await producto("MED1", { rubro: "MEDIAS", stock: "0" });
    await producto("COR1", { rubro: "CORPIÑOS" });
    await producto("LN25", { rubro: "LESS" });
    await guardarClientas([clienta(1), clienta(8)], AHORA);
    await compra(1, hace(25));
    await compra(8, hace(2), { codigo: "MED1", precio: 90_000n });
    await compra(8, hace(3), { codigo: "COR1", precio: 10_000n });
    await recalcularClientas(AHORA);

    const item = (await listaDeRecompra(HOY)).hoy.find(({ nombre }) => nombre === "Clienta 1");

    expect(item?.etapa).toBe("m2");
    expect(item?.mensaje).toContain("moviendo mucho corpiños");
    expect(item?.mensaje).not.toContain("medias");
  });

  it("el producto nuevo es del rubro de lo que compró, y tiene un bulto en stock", async () => {
    await producto("LN25", { rubro: "LESS" });
    await producto("LN99", { rubro: "LESS", alta: hace(2), stock: "0", nombre: "LESS SIN STOCK - UNIDAD" });
    await producto("LN98", { rubro: "LESS", alta: hace(5), nombre: "LESS LISA AMORARMA - UNIDAD" });
    await producto("COR9", { rubro: "CORPIÑOS", alta: hace(1), nombre: "CORPIÑO NUEVO - UNIDAD" });
    await unaClienta(hace(25));

    const [item] = (await listaDeRecompra(HOY)).hoy;

    expect(item?.etapa).toBe("m2");
    expect(item?.mensaje).toContain("Nos llegó less lisa amorarma");
  });

  it("sin datos para ofrecer, deja el lugar marcado en vez de inventar", async () => {
    await unaClienta(hace(25));

    const [item] = (await listaDeRecompra(HOY)).hoy;

    expect(item?.mensaje).toContain("[");
    expect(item?.nota).toMatch(/corchetes/);
  });

  it("dice que quedan pocas unidades solo si lo que compró se está agotando", async () => {
    await producto("LN25", { rubro: "LESS", stock: "3", nombre: "LESS POCAS - UNIDAD" });
    await guardarClientas([clienta(1), clienta(9)], AHORA);
    await compra(1, hace(40));
    // Se vendió hace 10 días, no esta semana: la única variante posible es la que usa el stock.
    await compra(9, hace(10), { cantidad: "30" });
    await recalcularClientas(AHORA);

    const item = (await listaDeRecompra(HOY)).hoy.find(({ nombre }) => nombre === "Clienta 1");

    expect(item?.etapa).toBe("m3");
    expect(item?.mensaje).toContain("estamos reponiendo less pocas y quedan pocas unidades");
  });

  it("ofrece un combo nuevo solo si tiene stock", async () => {
    await producto("LN25", { rubro: "LESS" });
    await producto("COMBO9", { rubro: "COMBOS", subrubro: "LENCERIA", tipo: "combo", alta: hace(10) });
    await producto("COMBO8", { rubro: "COMBOS", subrubro: "MEDIAS", tipo: "combo", alta: hace(1), stock: "0" });
    await unaClienta(hace(40));

    const [item] = (await listaDeRecompra(HOY)).hoy;

    expect(item?.mensaje).toContain("combo nuevo de lencería");
  });

  it("no se le puede decir a una clienta que un rubro sin stock se está moviendo", async () => {
    await producto("MED1", { rubro: "MEDIAS", stock: "0" });
    await producto("LN25", { rubro: "LESS", stock: "0" });
    await ventaDeLaSemana("MED1");
    await compra(1, hace(25));
    await guardarClientas([clienta(1)], AHORA);
    await recalcularClientas(AHORA);

    const item = (await listaDeRecompra(HOY)).hoy.find(({ nombre }) => nombre === "Clienta 1");

    expect(item?.mensaje).not.toContain("medias");
  });
});

describe("resultadosDeRecompra", () => {
  it("cuenta quién volvió a comprar en los 14 días siguientes, con su margen", async () => {
    await guardarClientas([clienta(1), clienta(2)], AHORA);
    await compra(1, hace(40));
    await compra(2, hace(40));
    await recalcularClientas(AHORA);
    const clientas = await db.customer.findMany({ orderBy: { normalizedPhone: "asc" } });
    await marcarRecompra(clientas[0]?.id ?? "", { estado: "contactada" }, null, hace(10));
    await marcarRecompra(clientas[1]?.id ?? "", { estado: "contactada" }, null, hace(9));
    await marcarRecompra(clientas[1]?.id ?? "", { estado: "respondio" }, null, hace(8));
    await compra(1, hace(3), { precio: 40_000n });

    expect(await resultadosDeRecompra(HOY)).toEqual({ contactadas: 2, compraron: 1, ventas: 400, margen: 100 });
  });

  it("posponer no cuenta como contacto", async () => {
    const id = await unaClienta(hace(8));
    await marcarRecompra(id, { estado: "pospuesta" }, null, HOY);

    expect((await resultadosDeRecompra(HOY)).contactadas).toBe(0);
  });

  it("sin contactos, todo en cero", async () => {
    expect(await resultadosDeRecompra(HOY)).toEqual({ contactadas: 0, compraron: 0, ventas: 0, margen: 0 });
  });
});

describe("la API de la recompra", () => {
  const pedir = (ruta: string, role: Role = "admin", init?: RequestInit, id?: string) =>
    dispatchApiRequest(new Request(`http://app.local${API_PREFIX}${ruta}`, init), {
      user: { role, id },
      realDomains: ["clientas"],
    });
  const marcar = (id: string, body: object, role: Role = "admin", usuario?: string) =>
    pedir(`/clientas/recompra/${id}`, role, { method: "PATCH", body: JSON.stringify(body) }, usuario);

  it("lee la lista y los resultados de la base", async () => {
    await unaClienta();

    const lista = await (await pedir("/clientas/recompra")).json();

    expect(lista.hoy[0].nombre).toBe("Clienta 1");
    expect(lista.tope).toBe(30);
    expect((await pedir("/clientas/recompra/resultados")).status).toBe(200);
  });

  it("guarda quién lo hizo", async () => {
    const id = await unaClienta();

    const respuesta = await marcar(id, { estado: "contactada", mensaje: "  Hola  " }, "admin", "usuario-7");

    expect(await respuesta.json()).toEqual({ estado: "contactada" });
    expect(await db.reactivationContact.findFirstOrThrow()).toMatchObject({ actorId: "usuario-7", message: "Hola" });
  });

  it("rechaza lo que no corresponde", async () => {
    const id = await unaClienta(hace(3));

    expect((await marcar(id, { estado: "otro" })).status).toBe(400);
    expect((await marcar(id, {})).status).toBe(400);
    expect((await marcar(newId(), { estado: "contactada" })).status).toBe(404);
    expect((await marcar(id, { estado: "contactada" })).status).toBe(409);
  });

  it.each<[Role, number, number]>([
    ["admin", 200, 200],
    ["operaciones", 200, 200],
    ["postventa", 200, 200],
    ["marketing", 200, 403],
    ["compras", 403, 403],
    ["solo_lectura", 403, 403],
  ])("%s lee %i y marca %i", async (role, leer, editar) => {
    const id = await unaClienta();

    expect((await pedir("/clientas/recompra", role)).status).toBe(leer);
    expect((await marcar(id, { estado: "contactada" }, role)).status).toBe(editar);
  });
});
