import { describe, expect, it } from "vitest";
import {
  armarMensaje,
  elegir,
  etapaQueToca,
  faltaCompletar,
  productoEnMensaje,
  resultadosDeContactos,
  rotacionDe,
  rubroEnMensaje,
  umbralAltoValor,
  type ClientaEnSecuencia,
  type ContactoPrevio,
  type DatosDelMensaje,
  type Etapa,
} from "./secuencia";

const HOY = "2026-11-05";
const haceDias = (dias: number) => new Date(Date.parse(HOY) - dias * 86_400_000).toISOString().slice(0, 10);

const UMBRAL = 1_000_000;
const RAPIDA = { compras: 5, cicloDias: 15 };
const LENTA = { compras: 2, cicloDias: 40 };

const clienta = (dias: number, cambios: Partial<ClientaEnSecuencia> = {}): ClientaEnSecuencia => ({
  ultimaCompra: haceDias(dias),
  compras: 1,
  cicloDias: null,
  margen12mCentavos: 5_000,
  ...cambios,
});

const contacto = (etapa: Etapa, dias: number, cambios: Partial<ContactoPrevio> = {}): ContactoPrevio => ({
  fecha: haceDias(dias),
  etapa,
  variante: "a",
  estado: "contactada",
  ...cambios,
});

const toca = (dias: number, cambios: Partial<ClientaEnSecuencia> = {}, contactos: ContactoPrevio[] = []) =>
  etapaQueToca(clienta(dias, cambios), contactos, UMBRAL, HOY);

describe("rotacionDe", () => {
  it.each([
    [20, "rapida"],
    [20.5, "lenta"],
    [5, "rapida"],
    [60, "lenta"],
    [null, "lenta"],
  ] as const)("ciclo de %s días: %s", (ciclo, rotacion) => {
    expect(rotacionDe(ciclo)).toBe(rotacion);
  });
});

describe("etapaQueToca, sin contactos previos", () => {
  it.each<[number, Etapa | null]>([
    [0, null],
    [6, null],
    [7, "m1"],
    [16, "m1"],
    [17, "m2"],
    [26, "m2"],
    [27, "m3"],
    [36, "m3"],
  ])("rotación rápida, a los %i días: %s", (dias, etapa) => {
    expect(toca(dias, RAPIDA)).toBe(etapa);
  });

  it.each<[number, Etapa | null]>([
    [6, null],
    [7, "m1"],
    [21, "m1"],
    [22, "m2"],
    [36, "m2"],
    [37, "m3"],
    [51, "m3"],
  ])("rotación lenta, a los %i días: %s", (dias, etapa) => {
    expect(toca(dias, LENTA)).toBe(etapa);
  });

  it("una sola compra va por la rotación lenta", () => {
    expect(toca(17)).toBe("m1");
    expect(toca(22)).toBe("m2");
  });

  it("nunca arranca por la despedida", () => {
    expect(toca(37, RAPIDA)).toBe("m3");
    expect(toca(52, LENTA)).toBe("m3");
    expect(toca(120, LENTA)).toBe("m3");
  });

  it("pasados los días de dormida va directo a la reactivación", () => {
    expect(toca(121, LENTA)).toBe("reactivacion");
    expect(toca(400)).toBe("reactivacion");
  });

  it("una dormida de alto valor recibe el mensaje personal", () => {
    expect(toca(200, { margen12mCentavos: UMBRAL })).toBe("alto_valor");
    expect(toca(200, { margen12mCentavos: UMBRAL - 1 })).toBe("reactivacion");
  });
});

describe("etapaQueToca, con contactos previos", () => {
  it("sigue la tabla de su rotación: rápida", () => {
    const m1 = [contacto("m1", 10)];
    expect(toca(16, RAPIDA, [contacto("m1", 9)])).toBeNull();
    expect(toca(17, RAPIDA, m1)).toBe("m2");
    expect(toca(27, RAPIDA, [contacto("m2", 10)])).toBe("m3");
    expect(toca(37, RAPIDA, [contacto("m3", 10)])).toBe("m4");
  });

  it("sigue la tabla de su rotación: lenta", () => {
    expect(toca(21, LENTA, [contacto("m1", 14)])).toBeNull();
    expect(toca(22, LENTA, [contacto("m1", 15)])).toBe("m2");
    expect(toca(37, LENTA, [contacto("m2", 15)])).toBe("m3");
    expect(toca(52, LENTA, [contacto("m3", 15)])).toBe("m4");
  });

  it("nunca más de un mensaje por semana, aunque le toque el siguiente", () => {
    expect(toca(37, LENTA, [contacto("m2", 6)])).toBeNull();
    expect(toca(38, LENTA, [contacto("m2", 7)])).toBe("m3");
  });

  it("si el tope demoró un mensaje, sigue en orden: no saltea", () => {
    expect(toca(60, LENTA, [contacto("m1", 53)])).toBe("m2");
  });

  it("si respondió, sale de la secuencia, aunque pase el tiempo", () => {
    expect(toca(40, LENTA, [contacto("m2", 20, { estado: "respondio" })])).toBeNull();
    expect(toca(300, LENTA, [contacto("m1", 293, { estado: "respondio" })])).toBeNull();
  });

  it("si vuelve a comprar, arranca de nuevo", () => {
    expect(toca(7, LENTA, [contacto("m4", 8), contacto("m3", 20)])).toBe("m1");
    expect(toca(7, LENTA, [contacto("m1", 30, { estado: "respondio" })])).toBe("m1");
  });

  it("un contacto del mismo día de la compra no es de este ciclo", () => {
    expect(toca(7, LENTA, [contacto("m1", 7)])).toBe("m1");
  });

  it("después de la despedida descansa 45 días y pasa a la reactivación", () => {
    expect(toca(90, LENTA, [contacto("m4", 44)])).toBeNull();
    expect(toca(90, LENTA, [contacto("m4", 45)])).toBe("reactivacion");
    expect(toca(90, { ...LENTA, margen12mCentavos: UMBRAL }, [contacto("m4", 45)])).toBe("alto_valor");
  });

  it("después de la reactivación no le toca nada más", () => {
    expect(toca(300, LENTA, [contacto("reactivacion", 60)])).toBeNull();
    expect(toca(300, LENTA, [contacto("alto_valor", 60)])).toBeNull();
  });

  it("posponer no cuenta como contacto", () => {
    expect(toca(22, LENTA, [contacto("m2", 1, { estado: "pospuesta" })])).toBe("m2");
    expect(toca(22, LENTA, [contacto("m2", 0, { estado: "pospuesta" })])).toBe("m2");
  });
});

describe("umbralAltoValor", () => {
  it("es el 17 % de las dormidas con más margen", () => {
    const margenes = Array.from({ length: 100 }, (_, indice) => (indice + 1) * 100);
    expect(umbralAltoValor(margenes)).toBe(8_400);
  });

  it("sin margen no hay alto valor", () => {
    expect(umbralAltoValor([0, -5])).toBe(1);
    expect(umbralAltoValor([])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("armarMensaje", () => {
  const datos = (cambios: Partial<DatosDelMensaje> = {}): DatosDelMensaje => ({
    nombre: "MARIA JOSE",
    categorias: ["medias"],
    productoNuevo: "less lisa amorarma",
    comboNuevo: "lencería",
    productoPorAgotarse: "boxer de algodon uomo",
    ...cambios,
  });
  const textos = (etapa: Etapa, cambios: Partial<DatosDelMensaje> = {}) =>
    new Set(Array.from({ length: 60 }, (_, indice) => armarMensaje(etapa, datos(cambios), `c-${indice}`).texto));

  it("saluda por el nombre de pila, sin apellido ni mayúsculas", () => {
    expect(armarMensaje("m1", datos(), "x").texto).toMatch(/Maria/);
    expect(armarMensaje("m1", datos(), "x").texto).not.toMatch(/JOSE/);
  });

  it.each<[Etapa, number]>([
    ["m1", 3],
    ["m2", 2],
    ["m3", 3],
    ["m4", 3],
    ["reactivacion", 2],
    ["alto_valor", 1],
  ])("%s tiene %i variantes, y rotan entre clientas", (etapa, variantes) => {
    expect(textos(etapa).size).toBe(variantes);
  });

  it("el mismo mensaje para la misma clienta: no cambia al recargar", () => {
    expect(armarMensaje("m3", datos(), "c-1")).toEqual(armarMensaje("m3", datos(), "c-1"));
  });

  it("no repite la variante que recibió la última vez", () => {
    for (let indice = 0; indice < 30; indice++) {
      const { variante } = armarMensaje("m1", datos(), `c-${indice}`, "a");
      expect(variante).not.toBe("a");
    }
  });

  it("con una sola variante posible, la repite antes que no mandar nada", () => {
    expect(armarMensaje("alto_valor", datos(), "x", "a").variante).toBe("a");
  });

  it("no ofrece lo que no tiene datos: sin producto nuevo, solo la de categoría", () => {
    for (const texto of textos("m2", { productoNuevo: null })) expect(texto).toMatch(/moviendo mucho medias/);
  });

  it("no dice que quedan pocas unidades si no se está agotando", () => {
    for (const texto of textos("m3", { productoPorAgotarse: null })) expect(texto).not.toMatch(/quedan pocas/);
  });

  it("no ofrece un combo si no hay uno nuevo", () => {
    for (const texto of textos("m3", { comboNuevo: null })) expect(texto).not.toMatch(/combo nuevo/);
  });

  it("el mensaje 1 no habla de reposición ni de stock", () => {
    for (const texto of textos("m1")) expect(texto).not.toMatch(/repon|stock/i);
  });

  it("usa lo que le pasan, tal cual", () => {
    expect([...textos("m2")].join(" ")).toContain("Nos llegó less lisa amorarma");
    expect([...textos("m3")].join(" ")).toContain("combo nuevo de lencería");
    expect([...textos("m3")].join(" ")).toContain("estamos reponiendo boxer de algodon uomo");
  });

  it("rota entre las categorías de la semana", () => {
    const usadas = [...textos("m2", { categorias: ["medias", "corpiños", "bodys"], productoNuevo: null })].join(" ");
    expect(usadas).toContain("mucho medias");
    expect(usadas).toContain("mucho corpiños");
    expect(usadas).toContain("mucho bodys");
  });

  it("sin nombre de pila queda marcado, y sin datos también: no se inventa", () => {
    const sinNombre = armarMensaje("m1", datos({ nombre: null }), "x").texto;
    expect(sinNombre).toMatch(/\[nombre\]|\[Nombre\]/);
    expect(faltaCompletar(sinNombre)).toBe(true);

    const sinDatos = armarMensaje("m2", datos({ categorias: [], productoNuevo: null }), "x").texto;
    expect(sinDatos).toContain("[categoría]");
    expect(faltaCompletar(sinDatos)).toBe(true);
  });

  it("con todo completo se puede mandar", () => {
    expect(faltaCompletar(armarMensaje("m3", datos(), "x").texto)).toBe(false);
  });
});

describe("elegir", () => {
  it("con una lista vacía, nada", () => {
    expect(elegir([], "x")).toBeUndefined();
  });
});

describe("rubroEnMensaje y productoEnMensaje", () => {
  it("nombra el rubro como se lo diría a una clienta", () => {
    expect(rubroEnMensaje("CONJUNTOS DE LENCERIA")).toBe("conjuntos de lencería");
    expect(rubroEnMensaje("HOMBRE")).toBe("boxers de hombre");
    expect(rubroEnMensaje("RUBRO NUEVO")).toBe("rubro nuevo");
  });

  it("lo que no es una categoría para ofrecer no se nombra", () => {
    expect(rubroEnMensaje("COMBOS")).toBeNull();
    expect(rubroEnMensaje("ENVIOS Y EMBALAJE")).toBeNull();
    expect(rubroEnMensaje(null)).toBeNull();
  });

  it.each([
    ["LESS LISA AMORARMA - CURVA DE TALLES L A 2XL - UNIDAD", "less lisa amorarma"],
    ["BOMBACHA DE NENA KUROMI Y MELODY 2-14 (MEDIA DOCENA)", "bombacha de nena kuromi y melody 2-14"],
    ["SOQUETE ECONOMICO HOMBRE - UNA DOCENA", "soquete economico hombre"],
    ["BOXER DE ALGODON UOMO ADULTO CURVA DE TALLES M-4XL - UNIDAD", "boxer de algodon uomo adulto"],
    ["BOXER UOMO NIÑO TENSSUNG- TALLES 4 A 12 (MEDIA DOCENA)", "boxer uomo niño tenssung"],
  ])("%s → %s", (nombre, esperado) => {
    expect(productoEnMensaje(nombre)).toBe(esperado);
  });
});

describe("resultadosDeContactos", () => {
  const compra = (clienta: string, id: number, fecha: string) => ({
    clienta,
    id,
    fecha,
    totalCentavos: 10_000,
    margenCentavos: 2_500,
  });

  it("cuenta las compras de los 14 días siguientes al mensaje", () => {
    const resultado = resultadosDeContactos(
      [{ clienta: "a", fecha: "2026-10-01" }],
      [
        compra("a", 1, "2026-10-01"),
        compra("a", 2, "2026-10-02"),
        compra("a", 3, "2026-10-15"),
        compra("a", 4, "2026-10-16"),
      ],
    );
    expect(resultado).toEqual({ contactadas: 1, compraron: 1, ventasCentavos: 20_000, margenCentavos: 5_000 });
  });

  it("una compra anterior al mensaje no cuenta", () => {
    const resultado = resultadosDeContactos([{ clienta: "a", fecha: "2026-10-10" }], [compra("a", 1, "2026-10-05")]);
    expect(resultado.compraron).toBe(0);
  });

  it("no mezcla clientas", () => {
    const resultado = resultadosDeContactos(
      [
        { clienta: "a", fecha: "2026-10-01" },
        { clienta: "b", fecha: "2026-10-01" },
      ],
      [compra("c", 1, "2026-10-02")],
    );
    expect(resultado).toEqual({ contactadas: 2, compraron: 0, ventasCentavos: 0, margenCentavos: 0 });
  });

  it("con dos mensajes, la compra se cuenta una vez y la clienta también", () => {
    const resultado = resultadosDeContactos(
      [
        { clienta: "a", fecha: "2026-10-01" },
        { clienta: "a", fecha: "2026-10-08" },
      ],
      [compra("a", 1, "2026-10-10")],
    );
    expect(resultado).toEqual({ contactadas: 1, compraron: 1, ventasCentavos: 10_000, margenCentavos: 2_500 });
  });

  it("sin contactos, todo en cero", () => {
    expect(resultadosDeContactos([], [compra("a", 1, "2026-10-10")])).toEqual({
      contactadas: 0,
      compraron: 0,
      ventasCentavos: 0,
      margenCentavos: 0,
    });
  });
});
