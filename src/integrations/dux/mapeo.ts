import { ExternalServiceError } from "@/lib/errors";
import { Money } from "@/lib/money";
import type { ErpClienta, ErpComprobante, ErpItem, PaginaDeClientas } from "@/modules/inventory/erp-gateway";
import type { DuxCliente, DuxFactura, DuxItem } from "./schemas";

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

const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Nov 3, 2026 3:00:00 AM" → "2026-11-03". Se lee el texto, sin pasar por Date: el
 * resultado no puede depender de la zona horaria del servidor.
 */
export function fechaDeDux(texto: string): string {
  const [, mes = "", dia = "", anio = ""] = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(texto) ?? [];
  const numeroDeMes = MESES.indexOf(mes) + 1;
  if (!numeroDeMes) throw new ExternalServiceError("DUX", "DUX respondió con una fecha que no esperábamos.");
  return `${anio}-${String(numeroDeMes).padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export function aErpComprobante(factura: DuxFactura, sucursal: number): ErpComprobante {
  return {
    id: factura.id,
    sucursal,
    tipo: factura.tipo_comp,
    letra: factura.letra_comp,
    puntoDeVenta: factura.nro_pto_vta,
    numero: factura.nro_comp,
    fecha: fechaDeDux(factura.fecha_comp),
    clienteId: factura.id_cliente ?? null,
    pedido: factura.nro_pedido || null,
    totalCentavos: centavos(factura.total),
    anulado: factura.anulada?.toUpperCase() === "S",
    // Una línea sin código no es de ningún producto, y tampoco se sumó en la lectura del 04/11.
    lineas: (factura.detalles ?? []).flatMap((linea) => {
      const codigo = linea.cod_item?.trim();
      if (!codigo) return [];
      return {
        codigo,
        nombre: linea.item ?? "",
        cantidad: linea.ctd,
        precioCentavos: centavos(linea.precio_uni),
        descuentoPct: linea.porc_desc,
        ivaPct: linea.porc_iva,
        costoCentavos: centavos(linea.costo),
      };
    }),
  };
}

export function aErpClienta(cliente: DuxCliente): ErpClienta {
  return {
    id: cliente.id_cliente,
    nombre: cliente.full_name.trim(),
    nombrePila: cliente.nombre?.trim() || null,
    telefono: cliente.telefono?.trim() || cliente.cel?.trim() || null,
    email: cliente.email?.trim() || null,
    provincia: cliente.provincia?.trim() || null,
    localidad: cliente.localidad?.trim() || null,
    habilitada: cliente.habilitado,
    creadaEl: cliente.fecha_creacion || null,
  };
}

/** Sin un total en el que confiar, la última página es la primera incompleta. */
export function aPaginaDeClientas({ datos }: { datos: DuxCliente[] }, porPagina: number): PaginaDeClientas {
  return { clientas: datos.map(aErpClienta), hayMas: datos.length === porPagina };
}
