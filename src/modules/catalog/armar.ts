import { leerCodigo, normalizarCodigo, type TipoDeCodigo } from "./codigos";

/**
 * Arma el catálogo desde el Sheet, Drive y DUX (`solucion_doc/06` §6.2). Sin base ni red.
 *
 * Se cruza siempre por SKU, nunca por nombre (RN-127): VX3 está renombrando todo. Si dos
 * fuentes no coinciden, gana el dueño del dato: código y nombre son de DUX; rubro, marca,
 * proveedor, tela, talles, colores, peso y medidas, del Sheet; las fotos, de Drive.
 *
 * En DUX cada código lleva su cantidad al final del nombre (`- UNIDAD`, `- MEDIA DOCENA`).
 * El producto reúne a todos sus códigos, así que se nombra sin ella.
 */

export type FilaDelSheet = {
  fila: number;
  /** Lo que ve el equipo, por encabezado. */
  visto: Record<string, string>;
  /** El valor crudo, por encabezado: un número escrito como texto se nota acá. */
  crudo: Record<string, unknown>;
};

export type ItemDeDux = {
  codigo: string;
  nombre: string;
  tipo: TipoDeCodigo;
  base: string;
  cantidad: number | null;
  rubro: string | null;
  subrubro: string | null;
  marca: string | null;
  proveedor: string | null;
  /** "2026-10-08" */
  creadoEl: string;
  tieneFoto: boolean;
};

export type ArchivoDeLaCarpeta = {
  driveId: string;
  nombre: string;
  mimeType: string;
  md5: string | null;
  ancho: number | null;
  alto: number | null;
};

/** `NO APLICA` no corresponde; `NO HAY DATO` corresponde pero no se tiene; vacío, falta cargarlo (RN-124). */
export type SituacionDelDato = "ok" | "falta" | "no_aplica" | "no_hay_dato";

export type DatoDelSheet = { valor: string | null; situacion: SituacionDelDato };

export type Presentacion = { codigo: string; tipo: TipoDeCodigo; cantidad: number | null; enDux: boolean };

export type FotoDelProducto = {
  driveId: string;
  nombre: string;
  posicion: number;
  ancho: number | null;
  alto: number | null;
};

export type ProductoArmado = {
  codigo: string;
  nombre: string;
  esCombo: boolean;
  rubro: string | null;
  subrubro: string | null;
  marca: DatoDelSheet;
  proveedor: DatoDelSheet;
  tela: DatoDelSheet;
  colores: string | null;
  talles: string | null;
  atributos: Record<string, string>;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
  pesoKg: number | null;
  /** "sin peso", "alto imposible: 300". Vacío si se puede cotizar el envío. */
  problemasDeEnvio: string[];
  enSheet: boolean;
  enDux: boolean;
  filaDelSheet: number | null;
  /** Lo que dice DUX, para ver si se contradice con el Sheet. */
  enDuxDice: { rubro: string | null; subrubro: string | null; marca: string | null; proveedor: string | null };
  tieneFotoEnDux: boolean;
  /** La fecha más vieja de sus códigos en DUX; null si no está. */
  creadoEl: string | null;
  presentaciones: Presentacion[];
  fotos: FotoDelProducto[];
};

export type FotoSuelta = { driveId: string; nombre: string; raiz: string };

export type CatalogoArmado = {
  productos: ProductoArmado[];
  /** Filas con BORRAR en `sku_nuevo`: se ignoran, y VX3 las borra después del re-cruce. */
  filasBorradas: number[];
  /** Códigos armados a mano antes del corte, como `HB2-1DOCENA`, sin su `sku_nuevo`. */
  filasConPackViejo: { fila: number; codigo: string }[];
  /** El mismo código en más de una fila: vale la primera, y una persona tiene que mirarlo. */
  codigosRepetidos: { codigo: string; filas: number[] }[];
  /** Fotos cuyo nombre no lleva a ningún producto. */
  fotosSueltas: FotoSuelta[];
  videos: number;
  /** Archivos `.IA`: no son fotos del producto (Elías, 04/11). */
  fotosIa: number;
};

export type DecisionesDelCatalogo = {
  /** A qué producto va una foto, por su ID de Drive; null si se descarta. */
  fotos?: ReadonlyMap<string, string | null>;
};

const BORRAR = /^BORRAR$/i;
const EXTENSION = /\.(jpe?g|png|jfif|heic|heif|webp)$/i;
const COPIA = /\s*-\s*copia(\s*\(\d+\))?$/i;
const DE_IA = /\.IA(-\d+)?$/i;
const MEDIAS_EN_EL_NOMBRE = /\b(MEDIAS?|SOQUETES?)\b/;
const CANTIDAD_DEL_NOMBRE = /\s*-\s*(?:UNIDAD|MEDIA DOCENA|UNA DOCENA|DOS DOCENAS|PACK DE \d+)\s*$/i;
const ATRIBUTOS = ["copa", "encaje", "push_up", "aro", "elastico", "tipo_bretel", "gancho_espalda", "otros_detalles"];
const MEDIDA_IMPOSIBLE_CM = 200;

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "");

export const nombreSinCantidad = (nombre: string) => nombre.replace(CANTIDAD_DEL_NOMBRE, "").trim();

export function leerDato(texto: string | null | undefined): DatoDelSheet {
  const limpio = texto?.trim() ?? "";
  if (!limpio) return { valor: null, situacion: "falta" };
  const comparable = sinTildes(limpio).toUpperCase();
  if (comparable === "NO APLICA") return { valor: null, situacion: "no_aplica" };
  if (comparable === "NO HAY DATO") return { valor: null, situacion: "no_hay_dato" };
  return { valor: limpio, situacion: "ok" };
}

function leerNumero(fila: FilaDelSheet, columna: string): { valor: number | null; problema: string | null } {
  const crudo = fila.crudo[columna];
  if (crudo === undefined || crudo === null || crudo === "") return { valor: null, problema: `sin ${columna}` };
  const valor = typeof crudo === "number" ? crudo : Number(String(crudo).trim().replace(",", "."));
  if (!Number.isFinite(valor)) return { valor: null, problema: `${columna} inválido: ${String(crudo)}` };
  if (valor <= 0) return { valor: null, problema: `${columna} en 0` };
  if (columna !== "peso" && valor > MEDIDA_IMPOSIBLE_CM)
    return { valor: null, problema: `${columna} imposible: ${valor}` };
  return { valor, problema: null };
}

/** El código que vale para una fila: `sku_nuevo` manda sobre `SKU`. Null si la fila se borra. */
function codigoDeLaFila({ visto }: FilaDelSheet): string | null {
  const nuevo = visto.sku_nuevo?.trim() ?? "";
  if (BORRAR.test(nuevo)) return null;
  return nuevo || (visto.SKU?.trim() ?? "");
}

const rubroDeLaFila = ({ visto }: FilaDelSheet) =>
  visto.categoria_tn?.trim() ||
  (MEDIAS_EN_EL_NOMBRE.test(sinTildes(visto["Nombre de DUX"] ?? "").toUpperCase()) ? "MEDIAS" : "");

const sinExtension = (nombre: string) => nombre.replace(EXTENSION, "").replace(COPIA, "");

/** El código que dice el nombre de una foto. Algunas se subieron sin extensión, o con "JPG" pegado. */
const codigoDeLaFoto = (nombre: string) =>
  normalizarCodigo(sinExtension(nombre).replace(/JPG$/i, "").replace(/-$/, ""));

/** La principal primero, y después por el número que lleva en el nombre. */
function ordenDeFotos(a: ArchivoDeLaCarpeta, b: ArchivoDeLaCarpeta): number {
  const numero = ({ nombre }: ArchivoDeLaCarpeta) => Number(/-(\d+)$/.exec(codigoDeLaFoto(nombre))?.[1] ?? 0);
  return numero(a) - numero(b) || a.nombre.localeCompare(b.nombre);
}

export function armarCatalogo({
  filas,
  items,
  archivos,
  decisiones = {},
}: {
  filas: FilaDelSheet[];
  items: ItemDeDux[];
  archivos: ArchivoDeLaCarpeta[];
  decisiones?: DecisionesDelCatalogo;
}): CatalogoArmado {
  const filasPorProducto = new Map<
    string,
    { fila: FilaDelSheet; codigo: string; cantidad: number | null; tipo: TipoDeCodigo }[]
  >();
  const itemsPorProducto = new Map<string, ItemDeDux[]>();
  const filasBorradas: number[] = [];
  const filasConPackViejo: CatalogoArmado["filasConPackViejo"] = [];

  for (const fila of filas) {
    const codigo = codigoDeLaFila(fila);
    if (codigo === null) {
      filasBorradas.push(fila.fila);
      continue;
    }
    const lectura = leerCodigo(codigo, rubroDeLaFila(fila));
    if (lectura.tipo === "no_producto") continue;
    if (lectura.tipo === "pack_viejo") {
      filasConPackViejo.push({ fila: fila.fila, codigo: lectura.normalizado });
      continue;
    }
    const propias = filasPorProducto.get(lectura.base) ?? [];
    propias.push({ fila, codigo: lectura.normalizado, cantidad: lectura.cantidad, tipo: lectura.tipo });
    filasPorProducto.set(lectura.base, propias);
  }

  for (const item of items) {
    if (item.tipo === "no_producto") continue;
    itemsPorProducto.set(item.base, [...(itemsPorProducto.get(item.base) ?? []), item]);
  }

  const codigos = [...new Set([...filasPorProducto.keys(), ...itemsPorProducto.keys()])].toSorted();
  const existe = new Set(codigos);

  /* ---- Fotos: el último segmento del nombre es el número de foto (RN-119) ---- */

  const fotosPorProducto = new Map<string, ArchivoDeLaCarpeta[]>();
  const fotosSueltas: FotoSuelta[] = [];
  let videos = 0;
  let fotosIa = 0;
  for (const archivo of archivos) {
    if (archivo.mimeType.startsWith("video/")) {
      videos += 1;
      continue;
    }
    if (DE_IA.test(sinExtension(archivo.nombre))) {
      fotosIa += 1;
      continue;
    }
    const decidido = decisiones.fotos?.get(archivo.driveId);
    if (decidido === null) continue;
    const limpio = codigoDeLaFoto(archivo.nombre);
    const raiz = /^(.+)-\d+$/.exec(limpio)?.[1] ?? limpio;
    // MSU2-1 puede ser la foto 1 de MSU2 o la principal de la variante MSU2-1: gana el producto entero.
    const destino = [decidido, limpio, raiz].find((codigo) => codigo !== undefined && existe.has(codigo));
    if (!destino) {
      fotosSueltas.push({ driveId: archivo.driveId, nombre: archivo.nombre, raiz });
      continue;
    }
    fotosPorProducto.set(destino, [...(fotosPorProducto.get(destino) ?? []), archivo]);
  }

  /* ---- Productos ---- */

  const codigosRepetidos: CatalogoArmado["codigosRepetidos"] = [];
  const productos = codigos.map((codigo): ProductoArmado => {
    const propias = filasPorProducto.get(codigo) ?? [];
    const propios = itemsPorProducto.get(codigo) ?? [];

    const porCodigo = Map.groupBy(propias, ({ codigo: delaFila }) => delaFila);
    for (const [repetido, grupo] of porCodigo) {
      if (grupo.length > 1) codigosRepetidos.push({ codigo: repetido, filas: grupo.map(({ fila }) => fila.fila) });
    }

    // La fila del producto es la de la prenda o el combo; la de un pack, solo si no hay otra.
    const fila = (propias.find(({ cantidad }) => cantidad === null) ?? propias[0])?.fila ?? null;
    const prenda = propios.find(({ tipo }) => tipo === "prenda");
    const combo = propios.find(({ tipo }) => tipo === "combo");
    const principal = combo ?? prenda ?? propios[0];
    const visto = fila?.visto ?? {};

    const presentaciones = new Map<string, Presentacion>();
    for (const { codigo: delaFila, tipo, cantidad } of propias) {
      presentaciones.set(delaFila, { codigo: delaFila, tipo, cantidad, enDux: false });
    }
    for (const item of propios) {
      const normalizado = normalizarCodigo(item.codigo);
      presentaciones.set(normalizado, { codigo: normalizado, tipo: item.tipo, cantidad: item.cantidad, enDux: true });
    }

    const medidas = ["largo", "ancho", "alto"].map((columna) => (fila ? leerNumero(fila, columna) : null));
    const peso = fila ? leerNumero(fila, "peso") : null;
    const problemasDeEnvio = fila
      ? [peso?.problema, ...medidas.map((medida) => medida?.problema)].filter((problema): problema is string =>
          Boolean(problema),
        )
      : ["no está en el Sheet"];

    const vistas = new Set<string>();
    const fotos = (fotosPorProducto.get(codigo) ?? [])
      .toSorted(ordenDeFotos)
      .filter(({ md5, nombre }) => {
        const clave = md5 ?? nombre;
        if (vistas.has(clave)) return false;
        vistas.add(clave);
        return true;
      })
      .map(({ driveId, nombre, ancho, alto }, posicion) => ({ driveId, nombre, posicion, ancho, alto }));

    return {
      codigo,
      nombre: nombreSinCantidad(principal?.nombre ?? visto["Nombre de DUX"] ?? ""),
      esCombo: Boolean(combo) || propias.some(({ tipo }) => tipo === "combo"),
      rubro: visto.categoria_tn?.trim() || principal?.rubro || null,
      subrubro: visto.subcategoria_tn?.trim() || principal?.subrubro || null,
      marca: leerDato(visto.marca_comercial),
      proveedor: leerDato(visto.Proveedor),
      tela: leerDato(visto.tela),
      colores: visto.curva_colores?.trim() || null,
      talles: visto.curva_talles?.trim() || null,
      atributos: Object.fromEntries(
        ATRIBUTOS.flatMap((atributo) => (visto[atributo]?.trim() ? [[atributo, visto[atributo].trim()]] : [])),
      ),
      largoCm: medidas[0]?.valor ?? null,
      anchoCm: medidas[1]?.valor ?? null,
      altoCm: medidas[2]?.valor ?? null,
      pesoKg: peso?.valor ?? null,
      problemasDeEnvio,
      enSheet: fila !== null,
      enDux: propios.length > 0,
      filaDelSheet: fila?.fila ?? null,
      enDuxDice: {
        rubro: principal?.rubro ?? null,
        subrubro: principal?.subrubro ?? null,
        marca: principal?.marca ?? null,
        proveedor: principal?.proveedor ?? null,
      },
      tieneFotoEnDux: propios.some(({ tieneFoto }) => tieneFoto),
      creadoEl: propios.map(({ creadoEl }) => creadoEl).toSorted()[0] ?? null,
      presentaciones: [...presentaciones.values()].toSorted((a, b) => a.codigo.localeCompare(b.codigo)),
      fotos,
    };
  });

  return { productos, filasBorradas, filasConPackViejo, codigosRepetidos, fotosSueltas, videos, fotosIa };
}
