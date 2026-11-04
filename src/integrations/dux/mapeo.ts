import { Money } from "@/lib/money";
import type { ErpItem } from "@/modules/inventory/erp-gateway";
import type { DuxItem } from "./schemas";

const centavos = (pesos: number) => Number(Money.fromPesos(pesos).cents);

/** DUX manda hasta 8 decimales: al sumar variantes, sin el ruido de la coma flotante. */
function sumar(valores: number[]): number {
  return Number(valores.reduce((suma, valor) => suma + valor, 0).toFixed(8));
}

export function aErpItem(item: DuxItem): ErpItem {
  return {
    codigo: item.cod_item,
    nombre: item.item,
    rubro: item.rubro?.nombre ?? null,
    subrubro: item.sub_rubro?.nombre ?? null,
    marca: item.marca?.marca ?? null,
    proveedorId: item.proveedor?.id_proveedor ?? null,
    proveedor: item.proveedor?.proveedor ?? null,
    costoCentavos: centavos(item.costo),
    precios: item.precios.map(({ id, nombre, precio }) => ({ listaId: id, lista: nombre, centavos: centavos(precio) })),
    stockReal: sumar(item.stock.map(({ stock_real: valor }) => valor)),
    stockReservado: sumar(item.stock.map(({ stock_reservado: valor }) => valor)),
    stockDisponible: sumar(item.stock.map(({ stock_disponible: valor }) => valor)),
    habilitado: item.habilitado,
    codigoExterno: item.codigo_externo,
    imagenUrl: item.imagen_url,
    creadoEl: item.fecha_creacion,
  };
}
