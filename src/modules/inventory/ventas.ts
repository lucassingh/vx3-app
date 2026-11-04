/**
 * Reglas de las ventas leídas del ERP (`solucion_doc/04` §1.6). Sin base ni red.
 */

/**
 * Desde este día, un código sin guion es la prenda. Hasta el 10/10 inclusive era el
 * bulto (RN-120): los códigos con guion se cargaron el 08/10, pero los viejos se
 * siguieron vendiendo hasta ese día.
 */
export const CORTE_PRENDA_BULTO = "2026-10-11";

/** Una venta que cuenta: ni anulada ni nota de crédito, que viene con total positivo. */
export function esVentaValida({ tipo, anulado }: { tipo: string; anulado: boolean }): boolean {
  return !anulado && !tipo.toUpperCase().includes("NOTA_CREDITO");
}

/** Lo mismo, para filtrar en la base. */
export const VENTA_VALIDA = { cancelled: false, NOT: { type: { contains: "NOTA_CREDITO" } } };

/** El ERP no manda subtotal: cantidad × precio × (1 − descuento). */
export function subtotalCentavos(linea: { cantidad: number; precioCentavos: number; descuentoPct: number }): number {
  return Math.round(linea.cantidad * linea.precioCentavos * (1 - linea.descuentoPct / 100));
}

export type MesDeHistorial = { mes: string; desde: string; hasta: string };

const dosDigitos = (valor: number) => String(valor).padStart(2, "0");

/** Los últimos meses completos, del más viejo al más nuevo. El mes en curso lo trae la lectura normal. */
export function mesesCompletos(hoy: string, cantidad: number): MesDeHistorial[] {
  const [anio, mes] = hoy.split("-").map(Number) as [number, number];
  return Array.from({ length: cantidad }, (_, indice) => {
    const atras = cantidad - indice;
    const inicio = new Date(Date.UTC(anio, mes - 1 - atras, 1));
    const fin = new Date(Date.UTC(anio, mes - atras, 0));
    const prefijo = `${inicio.getUTCFullYear()}-${dosDigitos(inicio.getUTCMonth() + 1)}`;
    return { mes: prefijo, desde: `${prefijo}-01`, hasta: `${prefijo}-${dosDigitos(fin.getUTCDate())}` };
  });
}
