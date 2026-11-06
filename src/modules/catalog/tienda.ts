import type { CatalogoAltaInput } from "@/lib/api/contracts/catalogo";
import { normalizeText } from "@/lib/utils";
import { presentacionesDe } from "./publicar";

/**
 * Qué se manda a Tienda Nube por un producto nuevo (RN-101, RN-102, RN-103, RN-127). Las categorías
 * las decide una tabla fija, no los datos de DUX: en septiembre, dos incidentes llenaron la tienda
 * de categorías duplicadas y huérfanas. Sin base ni red.
 */

type Regla =
  | { seccion: string; nivel3: boolean }
  /** Rubro que se funde en otra categoría, sin importar el subrubro. */
  | { seccion: string; destino: string; forzada: string }
  /** Ya es una sección: rubro › subrubro. */
  | { seccion: null };

/** La tabla del Hub, tal cual (`modules/tiendanube.py`). */
const RUBRO_SECCION: Record<string, Regla> = {
  CORPIÑOS: { seccion: "MUJER", nivel3: false },
  "CONJUNTOS DE LENCERIA": { seccion: "MUJER", nivel3: false },
  LESS: { seccion: "MUJER", nivel3: true },
  VEDETINA: { seccion: "MUJER", nivel3: true },
  UNIVERSALES: { seccion: "MUJER", nivel3: true },
  "CONJUNTO DEPORTIVO": { seccion: "MUJER", nivel3: false },
  DEPORTIVO: { seccion: "MUJER", nivel3: false },
  CULOTES: { seccion: "MUJER", nivel3: false },
  "BOXER MUJER": { seccion: "MUJER", nivel3: false },
  BODY: { seccion: "MUJER", nivel3: false },
  MALLAS: { seccion: "MUJER", nivel3: false },
  "REDUCTORES/ FAJAS": { seccion: "MUJER", nivel3: false },
  CORSET: { seccion: "MUJER", destino: "CORPIÑOS", forzada: "CORSET" },
  HOMBRE: { seccion: null },
  NIÑOS: { seccion: null },
  PIJAMA: { seccion: null },
  COMBOS: { seccion: null },
  MEDIAS: { seccion: null },
  "MEDIAS DEPORTIVAS": { seccion: null },
};

/** INVIERNO se reparte por subrubro: cada uno va a un público distinto. */
const INVIERNO_DESTINO: Record<string, { seccion: string | null; categoria: string }> = {
  "REMERA TERMICA MUJER": { seccion: "MUJER", categoria: "INVIERNO" },
  "CALZA TERMICA DE MUJER": { seccion: "MUJER", categoria: "INVIERNO" },
  PANTYS: { seccion: "MUJER", categoria: "INVIERNO" },
  "GUANTES MUJER": { seccion: "MUJER", categoria: "INVIERNO" },
  "REMERA TERMICA HOMBRE": { seccion: null, categoria: "HOMBRE" },
  "CALZA TERMICA DE HOMBRE": { seccion: null, categoria: "HOMBRE" },
  "CONJUNTO TERMICO HOMBRE": { seccion: null, categoria: "HOMBRE" },
  "REMERA TERMICA NIÑO/A": { seccion: null, categoria: "NIÑOS" },
  "CALZA TERMICA NIÑO": { seccion: null, categoria: "NIÑOS" },
};

/** Las raíces visibles. Las otras son sobras de los incidentes, y un producto nunca va ahí. */
export const SECCIONES_DE_LA_TIENDA = ["MUJER", "HOMBRE", "NIÑOS", "PIJAMA", "COMBOS", "MEDIAS", "MEDIAS DEPORTIVAS"];

const clave = (texto: string) => texto.trim().toUpperCase();

/**
 * El camino en la tienda. Null si el rubro o el subrubro de invierno no tienen regla: frena esa
 * alta y lo dice, nunca crea una categoría suelta (RN-102).
 */
export function rutaDeCategoria(rubro: string, subrubro: string): string[] | null {
  const nombreRubro = clave(rubro);
  const nombreSub = clave(subrubro);
  if (nombreRubro === "INVIERNO") {
    const destino = INVIERNO_DESTINO[nombreSub];
    if (!destino) return null;
    return destino.seccion ? [destino.seccion, destino.categoria, nombreSub] : [destino.categoria];
  }
  const regla = RUBRO_SECCION[nombreRubro];
  if (!regla) return null;
  if (regla.seccion === null) return nombreSub ? [nombreRubro, nombreSub] : [nombreRubro];
  if ("destino" in regla) return [regla.seccion, regla.destino, regla.forzada];
  return regla.nivel3 && nombreSub ? [regla.seccion, nombreRubro, nombreSub] : [regla.seccion, nombreRubro];
}

export type CategoriaParaBuscar = {
  id: number;
  parent: number | null;
  name: Record<string, string | null>;
  visibility?: string | null;
};

const seLlama = ({ name }: CategoriaParaBuscar, nombre: string) =>
  Object.values(name).some((valor) => valor && normalizeText(valor.trim()) === normalizeText(nombre));

const esHijaDe = ({ parent }: CategoriaParaBuscar, padre: number | null) => (parent || null) === padre;

const estaOculta = ({ visibility }: CategoriaParaBuscar) => visibility === "hidden";

/**
 * Busca cada nivel por nombre y por padre, y nunca en una oculta: hay 27 raíces que son sobras de
 * los incidentes de septiembre, y hasta 3 raíces MEDIAS, de las que solo una se ve.
 * Nunca crea una categoría: las nuevas las decide VX3 (`VX3_Hub_subida…` §4.5).
 */
export function categoriaDeLaRuta(
  ruta: readonly string[],
  categorias: readonly CategoriaParaBuscar[],
): { id: number } | { falta: string } {
  let padre: number | null = null;
  let id: number | null = null;
  for (const [nivel, nombre] of ruta.entries()) {
    const encontradas: CategoriaParaBuscar[] = categorias.filter(
      (categoria) => !estaOculta(categoria) && esHijaDe(categoria, padre) && seLlama(categoria, nombre),
    );
    const camino = ruta.slice(0, nivel + 1).join(" › ");
    if (encontradas.length === 0) return { falta: `Falta la categoría ${camino} en la tienda: la crea VX3.` };
    if (encontradas.length > 1) return { falta: `Hay ${encontradas.length} categorías ${camino} en la tienda.` };
    padre = encontradas[0]!.id;
    id = padre;
  }
  return id === null ? { falta: "No hay categoría para este producto." } : { id };
}

/** A qué sección raíz pertenece una categoría. Null si cuelga de una raíz oculta. */
export function seccionDeLaCategoria(id: number, categorias: ReadonlyMap<number, CategoriaParaBuscar>): string | null {
  let actual = categorias.get(id);
  const vistas = new Set<number>();
  while (actual?.parent && !vistas.has(actual.id)) {
    vistas.add(actual.id);
    actual = categorias.get(actual.parent);
  }
  if (!actual || estaOculta(actual)) return null;
  const raiz = actual;
  return SECCIONES_DE_LA_TIENDA.find((seccion) => seLlama(raiz, seccion)) ?? null;
}

/* ---- El producto ------------------------------------------------------------ */

/** El bulto: lo define el rubro, no una columna (RN-101). Nunca un `-3` ni la prenda suelta. */
export function bultoDe(input: CatalogoAltaInput) {
  const bulto = presentacionesDe(input).find(({ esBulto }) => esBulto);
  if (!bulto) throw new Error(`${input.sku} no tiene bulto.`);
  return bulto;
}

const NO_VAN_EN_LA_DESCRIPCION = /^(NO TIENE|NO CORRESPONDE|N\/A|-|NO|SI|SÍ|NO APLICA|NO HAY DATO)$/i;

const dato = (valor: string | null | undefined) => {
  const limpio = valor?.trim() ?? "";
  return !limpio || NO_VAN_EN_LA_DESCRIPCION.test(limpio) ? "" : limpio;
};

/** Con los atributos, en el mismo orden que el Hub (RN-103). Saltea lo vacío. La IA se suma en la 2.4. */
export function descripcionDeLaTienda(input: CatalogoAltaInput): string {
  const { atributos } = input;
  const partes: [string, string | undefined][] = [
    ["Marca", input.marca],
    ["Pack", bultoDe(input).label],
    ["Colores", input.colores.join(", ")],
    ["Talles", input.talles],
    ["Tela", input.tela],
    ["Copa", input.copa],
    ["Encaje", atributos.encaje],
    ["Push up", atributos.push_up],
    ["Aro", atributos.aro],
    ["Elástico", atributos.elastico],
    ["Bretel", atributos.tipo_bretel],
    ["Gancho", atributos.gancho_espalda],
  ];
  const texto = partes.flatMap(([titulo, valor]) => (dato(valor) ? [`${titulo}: ${dato(valor)}.`] : []));
  const detalles = dato(atributos.otros_detalles);
  return [...texto, ...(detalles ? [`${detalles}.`] : [])].join(" ");
}

/**
 * Oculto y a precio 0: el precio y el stock los completa DUX por SKU, a los pocos minutos. Se
 * muestra recién cuando llegó el precio (RN-101): el Hub lo deja visible a $ 0 un rato.
 */
export function pedidoDeProducto(input: CatalogoAltaInput, categoriaId: number) {
  const bulto = bultoDe(input);
  const [largo, ancho, alto] = input.medidasCm;
  return {
    name: { es: bulto.nombre },
    description: { es: descripcionDeLaTienda(input) },
    published: false,
    categories: [categoriaId],
    variants: [
      {
        sku: bulto.codigo,
        price: "0",
        ...(input.pesoBultoKg > 0 ? { weight: input.pesoBultoKg } : {}),
        ...(ancho > 0 ? { width: ancho } : {}),
        ...(alto > 0 ? { height: alto } : {}),
        ...(largo > 0 ? { depth: largo } : {}),
      },
    ],
  };
}
