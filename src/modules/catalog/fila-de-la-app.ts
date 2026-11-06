import type { CatalogoAltaInput, FotoSubida } from "@/lib/api/contracts/catalogo";

/**
 * Un producto cargado en la app vive en la misma copia que las filas del Sheet, con los mismos
 * encabezados: así el catálogo se sigue armando de un solo lado. Sus números de fila empiezan acá,
 * para no chocar con los del Sheet ni confundirse con ellos.
 */
export const FILA_DE_LA_APP = 1_000_000;

export type DatosDeLaFicha = {
  tela: string;
  colores: string;
  talles: string;
  atributos: Record<string, string>;
  pesoKg: number;
  medidasCm: [number, number, number];
};

/** Lo que se puede editar. En el crudo, los números van como números: así los lee el armado. */
export function celdasDeLaFicha({ tela, colores, talles, atributos, pesoKg, medidasCm }: DatosDeLaFicha) {
  const [largo, ancho, alto] = medidasCm;
  const numeros = { largo, ancho, alto, peso: pesoKg };
  const textos = { tela, curva_colores: colores, curva_talles: talles, ...atributos };
  return {
    shown: {
      ...textos,
      ...Object.fromEntries(Object.entries(numeros).map(([clave, valor]) => [clave, String(valor)])),
    },
    raw: { ...textos, ...numeros },
  };
}

/** La fila entera de un producto nuevo, con los encabezados del Sheet. */
export function filaDelAlta(input: CatalogoAltaInput, proveedor: string) {
  const { shown, raw } = celdasDeLaFicha({
    tela: input.tela,
    colores: input.colores.join(", "),
    talles: input.talles,
    atributos: { ...input.atributos, ...(input.copa ? { copa: input.copa } : {}) },
    pesoKg: input.pesoBultoKg,
    medidasCm: input.medidasCm,
  });
  const fijos = {
    SKU: input.sku,
    "Nombre de DUX": input.nombre,
    marca_comercial: input.marca,
    Proveedor: proveedor,
    categoria_tn: input.rubro,
    subcategoria_tn: input.subrubro,
  };
  return { shown: { ...fijos, ...shown }, raw: { ...fijos, ...raw }, appPhotos: input.fotos };
}

export type FotoDeLaFila = FotoSubida & {
  /** Ya se mandó a la tienda: no se vuelve a mandar. */
  enTienda?: boolean;
};

/** Las que se quitaron: se borran del store si nadie más las usa. */
export const fotosQuitadas = (antes: readonly FotoDeLaFila[], despues: readonly FotoDeLaFila[]) => {
  const quedan = new Set(despues.map(({ clave }) => clave));
  return antes.filter(({ clave }) => !quedan.has(clave)).map(({ clave }) => clave);
};

/** Conserva lo que ya se sabía de cada foto: si ya está en la tienda, no se vuelve a mandar. */
export const unirFotos = (antes: readonly FotoDeLaFila[], despues: readonly FotoSubida[]): FotoDeLaFila[] =>
  despues.map((foto) => ({ ...foto, enTienda: antes.find(({ clave }) => clave === foto.clave)?.enTienda ?? false }));
