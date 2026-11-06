import { normalizeText } from "@/lib/utils";
import { esMedias, normalizarCodigo } from "./codigos";
import { calcularPresentaciones, type OpcionalesDeAlta, type PresentacionCalculada } from "./motor-precios";
import { etiquetaDePresentacion } from "./salud";

/**
 * Reglas del alta de un producto nuevo, de Elías (05/11): SKU (RN-03) y nombre (RN-127). Sin base
 * ni red. Los códigos que ya existen no se tocan: la regla vale de acá en adelante.
 */

/**
 * El prefijo de los subrubros que usan o usaban más de uno. Los demás tienen uno solo, y se
 * toma de sus productos (`prefijoDelSubrubro`).
 */
const PREFIJOS_DE_ELIAS: Record<string, Record<string, string>> = {
  "BOXER MUJER": { NORMAL: "BMN" },
  "CONJUNTO DEPORTIVO": { "TOP Y LESS NORMAL": "CDTLN", "TOP Y SHORT NORMAL": "CDTSN" },
  "CONJUNTOS DE LENCERIA": {
    "ARMADO LESS NORMAL": "CJALN",
    "ARMADO TRES PIEZAS NORMAL": "CJATN",
    "CUATRO PIEZAS NORMAL ARMADO": "CJACTN",
  },
  CORPIÑOS: {
    "ARMADO JUVENIL": "CAJ",
    "CORPIÑO ARMADO GRANDE": "CAG",
    "SEGUNDA PIEL NORMAL": "CSPN",
    "TOP SEGUNDA PIEL NORMAL": "CTSPN",
    "TOP SEGUNDA PIEL GRANDE": "CTSPG",
    "TASA SOFT JUVENIL": "CTSJ",
    "TOP DEPORTIVO GRANDE": "CTDG",
    "TOP DEPORTIVO NORMAL": "CTDN",
  },
  CULOTES: { GRANDES: "CLG", NORMAL: "CLN" },
  DEPORTIVO: { "BIKER NORMAL": "DBN" },
  INVIERNO: { "CALZA TERMICA DE MUJER": "ICTM", "REMERA TERMICA HOMBRE": "IRTH" },
  LESS: { "TALLES GRANDES": "LG" },
  MALLAS: { "BIKINI Y SHORT GRANDE": "MBSG" },
  MEDIAS: { "INVISIBLES HOMBRE": "MIH", "SOQUETE NIÑO": "MSN", "TENIS NIÑO": "MTNN" },
  "MEDIAS DEPORTIVAS": { TENIS: "MDTN" },
  NIÑOS: { "MASCULINOS BOXER": "NMB" },
  PIJAMA: { "INVIERNO NIÑO": "PIN", "VERANO MUJER": "PVM" },
  UNIVERSALES: { "UNIVERSAL GRANDE": "UG" },
  VEDETINA: { GRANDE: "VG" },
};

const clave = (rubro: string, subrubro: string) => `${normalizeText(rubro.trim())}|${normalizeText(subrubro.trim())}`;

const TABLA_DE_PREFIJOS = new Map(
  Object.entries(PREFIJOS_DE_ELIAS).flatMap(([rubro, subrubros]) =>
    Object.entries(subrubros).map(([subrubro, prefijo]) => [clave(rubro, subrubro), prefijo] as const),
  ),
);

/** Las letras del principio: "CJATN62-6" es CJATN. Un código sin letras, como "23", no tiene. */
export function prefijoDeCodigo(codigo: string): string | null {
  return /^([A-Z]+)\d/.exec(normalizarCodigo(codigo))?.[1] ?? null;
}

/**
 * El de la tabla de Elías; si no está, el que usa la mayoría de sus productos. Null si es un
 * subrubro nuevo: lo define VX3, no la app.
 */
export function prefijoDelSubrubro(
  rubro: string,
  subrubro: string,
  productos: readonly { rubro: string | null; subrubro: string | null; codigo: string }[],
): string | null {
  const definido = TABLA_DE_PREFIJOS.get(clave(rubro, subrubro));
  if (definido) return definido;
  const buscado = clave(rubro, subrubro);
  const cuantos = new Map<string, number>();
  for (const producto of productos) {
    if (!producto.rubro || !producto.subrubro || clave(producto.rubro, producto.subrubro) !== buscado) continue;
    const prefijo = prefijoDeCodigo(producto.codigo);
    if (prefijo) cuantos.set(prefijo, (cuantos.get(prefijo) ?? 0) + 1);
  }
  return [...cuantos].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/**
 * El siguiente libre dentro del prefijo. `codigos` tiene que traer todos los que existen o
 * existieron, inhabilitados incluidos: un número no se reusa nunca (RN-03).
 */
export function proximoCodigo(prefijo: string, codigos: readonly string[]): string {
  const propio = new RegExp(`^${prefijo}(\\d+)(?:-|$)`);
  const usados = codigos.map((codigo) => Number(propio.exec(normalizarCodigo(codigo))?.[1] ?? 0));
  return `${prefijo}${Math.max(0, ...usados) + 1}`;
}

/* ---- Nombre (RN-127) ------------------------------------------------------ */

/** "Todo en mayúsculas, sin tildes (la Ñ se mantiene)", y 2XL en vez de XXL. */
export function aFormatoDeNombre(texto: string): string {
  return texto
    .toUpperCase()
    .replaceAll("Ñ", "\0")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("\0", "Ñ")
    .replace(/\bXXXXL\b/g, "4XL")
    .replace(/\bXXXL\b/g, "3XL")
    .replace(/\bXXL\b/g, "2XL")
    .replace(/\s+/g, " ")
    .trim();
}

/** "M A 2XL" es una curva; "L/XL", un talle. Lo que ya viene escrito queda como está. */
function parteDeTalles(talles: string): string {
  const texto = aFormatoDeNombre(talles);
  if (!texto || /^(CURVA|TALLE)\b/.test(texto)) return texto;
  return /\s(A|Y)\s/.test(texto) ? `CURVA DE TALLES ${texto}` : `TALLE ${texto}`;
}

export type PartesDelNombre = {
  /** Prenda y detalle: "TOP SEGUNDA PIEL TIRA ANCHA". */
  prenda: string;
  marca?: string | null;
  talles: string;
  copa?: string | null;
  /** "COLORES BASICOS", "COLORES Y DISEÑOS DE LA FOTO", "COLORES SURTIDOS" o un color puntual. */
  color: string;
};

/** Sin la cantidad: la agrega cada presentación. `PRENDA + DETALLE + MARCA - TALLES - COLOR`. */
export function nombreDelProducto({ prenda, marca, talles, copa, color }: PartesDelNombre): string {
  const cabeza = aFormatoDeNombre([prenda, marca].filter(Boolean).join(" "));
  const copaEnElNombre = copa?.trim() && aFormatoDeNombre(`COPA ${copa.replace(/^\s*copa\s*/i, "")}`);
  return [cabeza, parteDeTalles(talles), copaEnElNombre, aFormatoDeNombre(color)].filter(Boolean).join(" - ");
}

/** Lo que "no va en el nombre" (RN-127): precios, promociones y envíos. */
export function problemasDelNombre(nombre: string): string[] {
  return [
    /\$|\b\d[\d.]*\s*PESOS\b/.test(nombre) && "El nombre no lleva precios.",
    /\bPROMO\b/.test(nombre) && 'El nombre no lleva "PROMO".',
    /\bENV[IÍ]OS?\b/.test(nombre) && "El nombre no lleva envíos.",
  ].filter((problema): problema is string => Boolean(problema));
}

/* ---- Antes de crear ------------------------------------------------------- */

const NO_DISTINGUEN = new Set(["a", "con", "de", "del", "el", "en", "la", "para", "sin", "y"]);

/**
 * Lo que comparte palabras con lo que se está cargando: buscar con todas dejaría afuera al que solo
 * difiere en un detalle, que es justo el que interesa ver (RN-04). Con dos en común alcanza. Van
 * primero los que comparten más; a igual cantidad, los del mismo subrubro, y después, el orden que traían.
 */
export function losMasParecidos<T extends { texto: string; rubro: string | null; subrubro: string | null }>(
  productos: readonly T[],
  { q, rubro, subrubro }: { q: string; rubro?: string; subrubro?: string },
  limite = 5,
): T[] {
  const palabras = [...new Set(normalizeText(q).split(/\s+/))].filter(
    (palabra) => palabra.length > 1 && !NO_DISTINGUEN.has(palabra),
  );
  if (palabras.length === 0) return [];
  const minimo = Math.min(2, palabras.length);
  const buscado = rubro && subrubro ? clave(rubro, subrubro) : null;
  const mismoSubrubro = (producto: T) =>
    buscado !== null && producto.rubro && producto.subrubro && clave(producto.rubro, producto.subrubro) === buscado
      ? 1
      : 0;
  return productos
    .map((producto) => ({ producto, comunes: palabras.filter((palabra) => producto.texto.includes(palabra)).length }))
    .filter(({ comunes }) => comunes >= minimo)
    .toSorted((a, b) => b.comunes - a.comunes || mismoSubrubro(b.producto) - mismoSubrubro(a.producto))
    .slice(0, limite)
    .map(({ producto }) => producto);
}

/* ---- Presentaciones ------------------------------------------------------- */

export type PresentacionDelAlta = PresentacionCalculada & {
  /** El nombre completo, con su cantidad al final. */
  nombre: string;
  tipo: "SIMPLE" | "COMPUESTO";
};

/**
 * La prenda y sus packs según el rubro (RN-01, RN-115). La prenda de medias no se vende suelta,
 * pero existe: es el componente de sus packs, y no va en ninguna lista (RN-95).
 */
export function presentacionesDelAlta({
  sku,
  rubro,
  nombre,
  costoDocena,
  opcionales = {},
}: {
  sku: string;
  rubro: string;
  nombre: string;
  costoDocena: number;
  opcionales?: OpcionalesDeAlta;
}): PresentacionDelAlta[] {
  const familia = esMedias(rubro) ? "medias" : "lenceria";
  const calculadas = calcularPresentaciones(familia, sku, costoDocena, { docena: false, ...opcionales });
  const prendaDeMedias: PresentacionCalculada = {
    codigo: sku,
    label: "Prenda",
    terminacion: "UNIDAD",
    prendas: 1,
    coeficiente: 0,
    precio: 0,
    costo: Math.max(0, costoDocena) / 12,
    listas: [],
    esBulto: false,
  };
  return [...(familia === "medias" ? [prendaDeMedias] : []), ...calculadas].map((presentacion) => {
    const cantidad = presentacion.codigo === sku ? null : presentacion.prendas;
    const tipo = cantidad === null ? "prenda" : "pack";
    return {
      ...presentacion,
      nombre: `${nombre} - ${etiquetaDePresentacion({ tipo, cantidad }, rubro).toUpperCase()}`,
      tipo: cantidad === null ? "SIMPLE" : "COMPUESTO",
    };
  });
}
