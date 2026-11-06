/**
 * Cómo se lee un código de producto (`solucion_doc/02`, RN-104, RN-119, RN-120 y
 * RN-122). Lo usa el espejo de DUX y, desde la 1.8, el catálogo: es la llave que
 * une DUX, el Sheet y las fotos.
 *
 * Se lee de derecha a izquierda: el último segmento es cantidad solo si está en la
 * lista de su rubro, y todo lo de la izquierda es la identidad, variante incluida.
 * Partir por el primer guion rompe familias como MSU2: `MSU2-1` y `MSU2-4` son
 * productos distintos, y `MSU2-1-12` es la docena de `MSU2-1`.
 */

export type TipoDeCodigo = "prenda" | "pack" | "pack_viejo" | "combo" | "no_producto";

export type CodigoLeido = {
  tipo: TipoDeCodigo;
  /** La identidad del producto: "MSU2-1". */
  base: string;
  /** El código escrito igual en todas las fuentes: "LN 25" → "LN25". */
  normalizado: string;
  /** Unidades del pack; null si no es un pack o si es un pack viejo. */
  cantidad: number | null;
};

/** El -3 fuera de medias es a propósito: va donde VX3 lo decida, como en mallas y shorts (Elías, 04/11). */
const CANTIDADES = { medias: [3, 6, 12, 24], lenceria: [3, 6, 12] };

/** CF, y los que empiezan con ENVIO, EMBALAJE o FLETE (RN-104). */
const NO_ES_MERCADERIA = /^(CF$|ENVIO|EMBALAJE|FLETE)/;
/** Packs armados a mano antes del corte del 10/10: MSM2-2DOCENAS, HB2-1DOCENA, HB8-UNA DOCENA. */
const PACK_VIEJO = /^(.+?)-?(?:\d+|UNA|DOS)?DOCENAS?$/;

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "");

export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/\s+/g, "");
}

/** MEDIAS y MEDIAS DEPORTIVAS: el -6 no es el mismo bulto que en lencería (RN-115). */
export function esMedias(rubro: string | null | undefined): boolean {
  return /MEDIAS/.test(sinTildes(rubro ?? "").toUpperCase());
}

export function leerCodigo(codigo: string, rubro: string | null | undefined): CodigoLeido {
  const normalizado = normalizarCodigo(codigo);
  const resultado = (tipo: TipoDeCodigo, base: string, cantidad: number | null = null) => ({
    tipo,
    base,
    normalizado,
    cantidad,
  });

  if (NO_ES_MERCADERIA.test(normalizado)) return resultado("no_producto", normalizado);
  if (normalizado.startsWith("COMBO")) return resultado("combo", normalizado);

  const viejo = PACK_VIEJO.exec(normalizado);
  if (viejo?.[1]) return resultado("pack_viejo", viejo[1]);

  const separador = normalizado.lastIndexOf("-");
  if (separador > 0) {
    const base = normalizado.slice(0, separador);
    const cantidad = Number(normalizado.slice(separador + 1));
    if (CANTIDADES[esMedias(rubro) ? "medias" : "lenceria"].includes(cantidad)) {
      return resultado("pack", base, cantidad);
    }
  }
  return resultado("prenda", normalizado);
}

const DOCENA = "(?:DOCENAS?|DOCENTAS?|DOENAS?|DOCNEA|DCENA|DOC)";
const PACKS_EN_EL_NOMBRE: { unidades: number; patron: RegExp }[] = [
  { unidades: 6, patron: new RegExp(`\\b(?:MEDIA|MEDAI?D?|MEIDA|1/2)\\s*${DOCENA}\\b`) },
  { unidades: 24, patron: new RegExp(`\\b(?:DOS|2)\\s*${DOCENA}\\b`) },
  { unidades: 12, patron: new RegExp(`\\b(?:UNA|1)\\s*${DOCENA}\\b`) },
  { unidades: 1, patron: /\bUNIDAD\b/ },
];

/**
 * Qué presentación dice el nombre (RN-120), tolerando los typos que hay en el
 * catálogo. Antes del corte del 10/10, un código sin guion era el bulto y no la
 * prenda: para las ventas viejas, lo único que lo dice es el nombre.
 */
export function unidadesDelNombre(nombre: string): number | null {
  const texto = sinTildes(nombre).toUpperCase();
  return PACKS_EN_EL_NOMBRE.find(({ patron }) => patron.test(texto))?.unidades ?? null;
}
