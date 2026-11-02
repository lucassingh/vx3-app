/**
 * Motor de precios (RN-10 a RN-13, RN-95, RN-96): precios piso de cada
 * presentación a partir del costo de la docena. Es el mismo cálculo que usa la
 * API; lo comparten el alta, la recepción de compras y el control de margen.
 */

export type Familia = "lenceria" | "medias";

export type PresentacionCalculada = {
  codigo: string;
  label: string;
  /** Terminación que agrega el sistema al nombre (RN-05). */
  terminacion: string;
  prendas: number;
  coeficiente: number;
  precio: number;
  costo: number;
  listas: string[];
  esBulto: boolean;
};

export const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step;

const MAYORISTA = "MAYORISTA EF/TR";
const LOCAL = "LOCAL EF/TR";

export function calcularPresentaciones(familia: Familia, sku: string, costoDocena: number): PresentacionCalculada[] {
  const cd = Math.max(0, costoDocena);
  const base = sku || "SKU";

  if (familia === "medias") {
    return [
      {
        codigo: `${base}-3`,
        label: "Pack de 3",
        terminacion: "PACK DE 3",
        prendas: 3,
        coeficiente: 2.21,
        precio: ceilTo((cd / 4) * 2.21, 100),
        costo: cd / 4,
        listas: [LOCAL],
        esBulto: false,
      },
      {
        codigo: `${base}-6`,
        label: "Pack de 6",
        terminacion: "PACK DE 6",
        prendas: 6,
        coeficiente: 1.8182,
        precio: ceilTo((cd / 2) * 1.8182, 100),
        costo: cd / 2,
        listas: [LOCAL],
        esBulto: false,
      },
      {
        codigo: `${base}-12`,
        label: "Docena",
        terminacion: "DOCENA",
        prendas: 12,
        coeficiente: 1.3,
        precio: ceilTo(cd * 1.3, 100),
        costo: cd,
        listas: [MAYORISTA, LOCAL],
        esBulto: true,
      },
    ];
  }

  return [
    {
      codigo: base,
      label: "Prenda",
      terminacion: "UNIDAD",
      prendas: 1,
      coeficiente: 2.21,
      precio: ceilTo((cd / 12) * 2.21, 100),
      costo: cd / 12,
      listas: [LOCAL],
      esBulto: false,
    },
    {
      codigo: `${base}-6`,
      label: "Media docena",
      terminacion: "MEDIA DOCENA",
      prendas: 6,
      coeficiente: 1.3,
      precio: ceilTo((cd / 2) * 1.3, 100),
      costo: cd / 2,
      listas: [MAYORISTA, LOCAL],
      esBulto: true,
    },
    {
      codigo: `${base}-12`,
      label: "Docena",
      terminacion: "DOCENA",
      prendas: 12,
      coeficiente: 1.1765,
      precio: ceilTo(cd * 1.1765, 100),
      costo: cd,
      listas: [MAYORISTA, LOCAL],
      esBulto: false,
    },
  ];
}

/** Precio del bulto mayorista (-6 en lencería, -12 en medias). */
export function precioBulto(familia: Familia, costoDocena: number) {
  return calcularPresentaciones(familia, "", costoDocena).find((item) => item.esBulto)!;
}

/** Margen sobre el precio (fracción). */
export function margenDe(precio: number, costo: number) {
  return precio > 0 ? (precio - costo) / precio : 0;
}
