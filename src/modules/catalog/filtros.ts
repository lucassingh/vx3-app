import type {
  CatalogoFaceta,
  CatalogoFacetas,
  CatalogoQuery,
  CatalogoSalud,
  CatalogoVigencia,
} from "@/lib/api/contracts/catalogo";
import { normalizeText } from "@/lib/utils";

/**
 * Buscador del catálogo: qué productos pasan y cuántos hay por cada opción. Sin base ni red:
 * son unos 1.100 productos, y se filtran en memoria, como el espejo de stock.
 *
 * Tela, talles y colores son texto libre en el Sheet hasta el pase: se comparan sin tildes ni
 * mayúsculas, para que "ALGODON" y "ALGODÓN" sean una sola opción.
 */

export type ProductoFiltrable = {
  rubro: string | null;
  subrubro: string | null;
  marca: string | null;
  tela: string | null;
  talle: string | null;
  colores: string[];
  proveedor: string | null;
  vigencia: CatalogoVigencia;
  listo: boolean;
  /** Código, presentaciones, nombre, marca…, sin tildes ni mayúsculas. */
  texto: string;
};

const VIGENCIAS: CatalogoVigencia[] = ["activo", "agotado", "historico"];
const SALUDES: CatalogoSalud[] = ["listo", "no_listo"];

/** Lo que el buscador ofrece como opción, con el plural de cada faceta. */
const FACETAS = {
  rubro: { lista: "rubros", valores: ({ rubro }: ProductoFiltrable) => [rubro] },
  subrubro: { lista: "subrubros", valores: ({ subrubro }: ProductoFiltrable) => [subrubro] },
  marca: { lista: "marcas", valores: ({ marca }: ProductoFiltrable) => [marca] },
  tela: { lista: "telas", valores: ({ tela }: ProductoFiltrable) => [tela] },
  talle: { lista: "talles", valores: ({ talle }: ProductoFiltrable) => [talle] },
  color: { lista: "colores", valores: ({ colores }: ProductoFiltrable) => colores },
  proveedor: { lista: "proveedores", valores: ({ proveedor }: ProductoFiltrable) => [proveedor] },
} as const;

type Faceta = keyof typeof FACETAS;
const NOMBRES_DE_FACETAS = Object.keys(FACETAS) as Faceta[];

/** "BLANCO, NEGRO Y BEIGE" son tres colores. */
export function coloresDe(texto: string | null | undefined): string[] {
  const colores = (texto ?? "").split(/,|\/|\+|\s+Y\s+/i).map((color) => color.trim().toUpperCase());
  return [...new Set(colores.filter(Boolean))];
}

export function leerQueryDelCatalogo(leer: (parametro: string) => string | null | undefined): CatalogoQuery {
  const texto = (parametro: string) => leer(parametro)?.trim() || undefined;
  const estado = texto("estado") as CatalogoVigencia | undefined;
  const salud = texto("salud") as CatalogoSalud | undefined;
  return {
    q: texto("q"),
    ...Object.fromEntries(NOMBRES_DE_FACETAS.map((faceta) => [faceta, texto(faceta)])),
    estado: estado && VIGENCIAS.includes(estado) ? estado : undefined,
    salud: salud && SALUDES.includes(salud) ? salud : undefined,
  };
}

/** `salvo`: una faceta cuenta sus opciones sin mirar su propio filtro, para poder cambiarlo. */
export function pasaLosFiltros(producto: ProductoFiltrable, query: CatalogoQuery, salvo?: Faceta): boolean {
  const { q, estado, salud } = query;
  const palabras = normalizeText(q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (!palabras.every((palabra) => producto.texto.includes(palabra))) return false;
  // Un histórico sale del catálogo, pero se tiene que poder encontrar para reactivarlo (RN-125).
  if (estado ? producto.vigencia !== estado : !q && producto.vigencia === "historico") return false;
  if (salud && producto.listo !== (salud === "listo")) return false;
  return NOMBRES_DE_FACETAS.every((faceta) => {
    const buscado = query[faceta];
    if (!buscado || faceta === salvo) return true;
    return FACETAS[faceta].valores(producto).some((valor) => valor && normalizeText(valor) === normalizeText(buscado));
  });
}

function opcionesDe(productos: ProductoFiltrable[], faceta: Faceta, query: CatalogoQuery): CatalogoFaceta[] {
  const opciones = new Map<string, { etiquetas: Map<string, number>; productos: number }>();
  const contar = (producto: ProductoFiltrable, cuenta: boolean) => {
    for (const valor of FACETAS[faceta].valores(producto)) {
      if (!valor) continue;
      const clave = normalizeText(valor);
      const opcion = opciones.get(clave) ?? { etiquetas: new Map<string, number>(), productos: 0 };
      opcion.etiquetas.set(valor, (opcion.etiquetas.get(valor) ?? 0) + 1);
      if (cuenta) opcion.productos += 1;
      opciones.set(clave, opcion);
    }
  };
  const elegido = query[faceta] ? normalizeText(query[faceta]) : null;
  for (const producto of productos) {
    const pasa = pasaLosFiltros(producto, query, faceta);
    if (pasa || FACETAS[faceta].valores(producto).some((valor) => valor && normalizeText(valor) === elegido)) {
      contar(producto, pasa);
    }
  }
  return [...opciones]
    .filter(([clave, { productos: cantidad }]) => cantidad > 0 || clave === elegido)
    .map(([valor, { etiquetas, productos: cantidad }]) => ({
      valor,
      // La forma más usada: es la que mejor se lee.
      etiqueta: [...etiquetas].toSorted((a, b) => b[1] - a[1])[0]![0],
      productos: cantidad,
    }))
    .toSorted((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export function facetasDe(productos: ProductoFiltrable[], query: CatalogoQuery): CatalogoFacetas {
  return Object.fromEntries(
    NOMBRES_DE_FACETAS.map((faceta) => [FACETAS[faceta].lista, opcionesDe(productos, faceta, query)]),
  ) as CatalogoFacetas;
}
