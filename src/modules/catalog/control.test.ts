import { describe, expect, it } from "vitest";
import { armarControl, type CodigoDelControl, type ProductoDelControl, type ProductoEnLaTienda } from "./control";

const producto = (sku: string, cambios: Partial<ProductoDelControl> = {}): ProductoDelControl => ({
  sku,
  nombre: `Producto ${sku}`,
  esCombo: false,
  activo: true,
  bulto: `${sku}-6`,
  fotos: 1,
  ...cambios,
});

const MAYORISTA = (cents: number) => ({ list: "MAYORISTA EF/TR", cents });
const LOCAL = (cents: number) => ({ list: "LOCAL EF/TR", cents });

const prenda = (sku: string, precios = [LOCAL(1_000)]): CodigoDelControl => ({
  codigo: sku,
  base: sku,
  tipo: "prenda",
  cantidad: null,
  precios,
});

const pack = (sku: string, cantidad: number, precios = [MAYORISTA(6_000)]): CodigoDelControl => ({
  codigo: `${sku}-${cantidad}`,
  base: sku,
  tipo: "pack",
  cantidad,
  precios,
});

const publicado = (sku: string | null, cambios: Partial<ProductoEnLaTienda> = {}): ProductoEnLaTienda => ({
  id: 1n,
  sku,
  nombre: `En la tienda ${sku}`,
  publicado: true,
  seccion: "MUJER",
  ...cambios,
});

const correr = (datos: Partial<Parameters<typeof armarControl>[0]> = {}) =>
  armarControl({
    productos: [producto("LN1")],
    codigos: [prenda("LN1"), pack("LN1", 6)],
    tienda: [publicado("LN1-6")],
    seLeyoLaTienda: true,
    ...datos,
  });

const chequeo = (id: string, datos?: Partial<Parameters<typeof armarControl>[0]>) => {
  const encontrado = correr(datos).find((item) => item.id === id);
  if (!encontrado) throw new Error(`No está el chequeo ${id}`);
  return encontrado;
};

describe("un catálogo sano", () => {
  it("no marca nada en ningún chequeo", () => {
    expect(correr().flatMap(({ fallas }) => fallas)).toEqual([]);
  });

  it("dice cuánto revisó en cada uno", () => {
    expect(correr().map(({ id, revisados }) => [id, revisados])).toEqual([
      ["precio", 1],
      ["prenda-mayorista", 1],
      ["tienda-bulto", 1],
      ["tienda-falta", 1],
      ["foto", 1],
      ["secciones", 1],
    ]);
  });
});

describe("el bulto tiene precio", () => {
  it("sin precio en el mayorista, lo marca", () => {
    const { fallas } = chequeo("precio", { codigos: [prenda("LN1"), pack("LN1", 6, [LOCAL(6_000)])] });

    expect(fallas).toEqual([{ sku: "LN1", nombre: "Producto LN1", detalle: "LN1-6 no tiene precio." }]);
  });

  it("un bulto que no está en DUX lo marca", () => {
    expect(chequeo("precio", { codigos: [prenda("LN1")] }).fallas[0]?.detalle).toBe("LN1-6 no está en DUX.");
  });

  it("un activo sin bulto, también; un histórico o agotado sin bulto, no", () => {
    expect(chequeo("precio", { productos: [producto("LN1", { bulto: null })] }).fallas[0]?.detalle).toBe(
      "No tiene bulto en DUX.",
    );
    expect(chequeo("precio", { productos: [producto("LN1", { bulto: null, activo: false })] }).fallas).toEqual([]);
  });
});

describe("la prenda queda fuera del mayorista", () => {
  it("con precio en el mayorista, lo marca", () => {
    const codigos = [prenda("LN1", [LOCAL(1_000), MAYORISTA(900)]), pack("LN1", 6)];

    expect(chequeo("prenda-mayorista", { codigos }).fallas[0]?.detalle).toBe("Tiene precio en el mayorista.");
  });

  it("un combo no es una prenda", () => {
    const codigos = [{ ...prenda("COMBO1", [MAYORISTA(900)]), tipo: "combo" }];

    expect(chequeo("prenda-mayorista", { productos: [producto("COMBO1", { esCombo: true })], codigos }).fallas).toEqual(
      [],
    );
  });
});

describe("la tienda publica el bulto", () => {
  const conLoPublicado = (sku: string) =>
    chequeo("tienda-bulto", {
      codigos: [prenda("LN1"), pack("LN1", 3), pack("LN1", 6), pack("LN1", 12)],
      tienda: [publicado(sku)],
    }).fallas;

  it("la prenda suelta no", () => {
    expect(conLoPublicado("LN1")[0]?.detalle).toBe("Es la prenda suelta: en la tienda va el bulto.");
  });

  it("un pack de 3 no", () => {
    expect(conLoPublicado("LN1-3")[0]?.detalle).toBe("Es un pack de 3: no se publica.");
  });

  it("una docena de lencería no", () => {
    expect(conLoPublicado("LN1-12")[0]?.detalle).toBe("El bulto es LN1-6.");
  });

  it("el bulto sí", () => {
    expect(conLoPublicado("LN1-6")).toEqual([]);
  });

  it("DSN10 y DSN11 son la excepción: van en -6 y en -12", () => {
    const { fallas } = chequeo("tienda-bulto", {
      productos: [producto("DSN10")],
      codigos: [prenda("DSN10"), pack("DSN10", 6), pack("DSN10", 12)],
      tienda: [publicado("DSN10-6"), publicado("DSN10-12")],
    });

    expect(fallas).toEqual([]);
  });

  it("un SKU que no está en DUX se despublica", () => {
    expect(conLoPublicado("41-6")[0]?.detalle).toBe("No existe en DUX: se despublica, no se borra.");
  });

  it("un SKU escrito con espacios es el mismo código", () => {
    const { fallas } = chequeo("tienda-bulto", {
      productos: [producto("LN25")],
      codigos: [prenda("LN25"), pack("LN25", 6)],
      tienda: [publicado("LN 25-6")],
    });

    expect(fallas).toEqual([]);
    expect(
      chequeo("tienda-falta", {
        productos: [producto("LN25")],
        codigos: [prenda("LN25"), pack("LN25", 6)],
        tienda: [publicado("LN 25-6")],
      }).fallas,
    ).toEqual([]);
  });

  it("un producto sin SKU no se puede cruzar", () => {
    expect(chequeo("tienda-bulto", { tienda: [publicado(null, { id: 9n })] }).fallas[0]).toMatchObject({
      sku: "ID 9",
      detalle: "No tiene SKU: no se puede cruzar.",
    });
  });

  it("lo despublicado no cuenta", () => {
    const { fallas, revisados } = chequeo("tienda-bulto", { tienda: [publicado("LN1", { publicado: false })] });

    expect(fallas).toEqual([]);
    expect(revisados).toBe(0);
  });
});

describe("lo activo está en la tienda", () => {
  it("si falta, lo marca", () => {
    expect(chequeo("tienda-falta", { tienda: [] }).fallas[0]?.detalle).toBe("LN1-6 no está en la tienda.");
  });

  it("un agotado no tiene por qué", () => {
    expect(chequeo("tienda-falta", { productos: [producto("LN1", { activo: false })], tienda: [] }).fallas).toEqual([]);
  });
});

describe("lo activo tiene foto", () => {
  it("sin foto, lo marca", () => {
    expect(chequeo("foto", { productos: [producto("LN1", { fotos: 0 })] }).fallas[0]?.detalle).toBe("No tiene foto.");
  });

  it("un agotado no se revisa", () => {
    const { fallas, revisados } = chequeo("foto", { productos: [producto("LN1", { fotos: 0, activo: false })] });

    expect(fallas).toEqual([]);
    expect(revisados).toBe(0);
  });
});

describe("las secciones suman el total", () => {
  it("dice la suma, y marca el que no cuelga de ninguna", () => {
    const { label, fallas } = chequeo("secciones", {
      tienda: [
        publicado("A-6", { seccion: "MUJER" }),
        publicado("B-6", { seccion: "HOMBRE" }),
        publicado("C-6", { seccion: null, id: 5n }),
      ],
    });

    expect(label).toContain("(2 de 3)");
    expect(fallas).toEqual([
      {
        sku: "C-6",
        nombre: "En la tienda C-6",
        detalle: "No cuelga de ninguna sección: no aparece en ningún menú.",
      },
    ]);
  });

  it("si suman el total, no hay nada que marcar", () => {
    const { label, fallas } = chequeo("secciones", {
      tienda: [publicado("A-6", { seccion: "MUJER" }), publicado("B-6", { seccion: "MEDIAS DEPORTIVAS" })],
    });

    expect(label).toContain("(2 de 2)");
    expect(fallas).toEqual([]);
  });
});

describe("sin haber leído la tienda", () => {
  it("lo dice, y no marca como faltante todo lo activo", () => {
    const control = correr({ tienda: [], seLeyoLaTienda: false });

    expect(control.find(({ id }) => id === "tienda-falta")).toMatchObject({
      fallas: [],
      revisados: 0,
      aviso: expect.stringContaining("Todavía no se leyó la tienda"),
    });
    expect(control.find(({ id }) => id === "precio")).not.toHaveProperty("aviso");
  });
});
