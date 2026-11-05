import { businessTime } from "@/lib/dates";
import type { DatoDelSheet, ProductoArmado } from "./armar";
import { esMedias } from "./codigos";

/**
 * Lo que se calcula de cada producto armado: su estado (RN-125), su prioridad por ventas y lo
 * que le falta para venderse (RN-124). Sin base ni red.
 */

export type EstadoDelProducto = "activo" | "agotado" | "historico";
export type PrioridadDelProducto = "A" | "B" | "C";

/** `falta` se puede cargar; `no_hay_dato` es definitivo y se muestra aparte. */
export type Faltante = { dato: DatoQueFalta; situacion: "falta" | "no_hay_dato" };
export type DatoQueFalta = "nombre" | "precio" | "costo" | "envio" | "foto" | "sheet" | "tela" | "marca" | "proveedor";

/** Lo deseable no bloquea la venta (RN-124). Sin fila del Sheet, lo que la bloquea es el envío. */
const NO_BLOQUEAN = new Set<DatoQueFalta>(["tela", "marca", "proveedor", "sheet"]);

type PuestoPorVentas = { prioridad: PrioridadDelProducto; ranking: number | null };

/** La ventana de la prioridad y de "no es nuevo". */
export const DIAS_DE_VENTAS = 90;
/** La ventana de la última venta: una venta más vieja es lo mismo que ninguna. */
export const DIAS_DEL_ANIO = 365;
export const LISTA_DEL_BULTO = "MAYORISTA EF/TR";

const MESES_PARA_HISTORICO = 6;
const PARETO = 0.8;
const RUBROS_DE_TEMPORADA = new Set(["INVIERNO", "PIJAMA", "MALLAS"]);

export type VentaDelProducto = { centavos90: number; ultimaVenta: string };

export type CodigoDelEspejo = { stock: number; precioCentavos: number; costoCentavos: number };

export type EvaluacionDelProducto = {
  estado: EstadoDelProducto;
  deTemporada: boolean;
  prioridad: PrioridadDelProducto;
  /** Puesto por ventas; null si no vendió en la ventana. */
  ranking: number | null;
  ventas90Centavos: number;
  ultimaVenta: string | null;
  codigoDelBulto: string | null;
  faltantes: Faltante[];
  listoParaVender: boolean;
};

/**
 * El bulto lo define el rubro, no la columna `pack` (RN-101, RN-115): `-12` en medias, `-6` en el
 * resto. `sku_venta` es la excepción cargada a mano, y un combo es su propio bulto.
 */
export function codigoDelBulto({ skuDeVenta, presentaciones, rubro }: ProductoArmado): string | null {
  if (skuDeVenta) return skuDeVenta;
  const combo = presentaciones.find(({ tipo }) => tipo === "combo");
  if (combo) return combo.codigo;
  const cantidad = esMedias(rubro) ? 12 : 6;
  return presentaciones.find((presentacion) => presentacion.cantidad === cantidad)?.codigo ?? null;
}

/** En prendas. Un combo tiene stock propio; un pack se calcula desde la prenda, salvo que no haya prenda. */
function stockDelProducto({ presentaciones }: ProductoArmado, espejo: ReadonlyMap<string, CodigoDelEspejo>): number {
  const stockDe = (codigo: string) => espejo.get(codigo)?.stock ?? 0;
  const propio =
    presentaciones.find(({ tipo }) => tipo === "combo") ?? presentaciones.find(({ tipo }) => tipo === "prenda");
  if (propio) return stockDe(propio.codigo);
  return presentaciones.reduce((suma, { codigo, cantidad }) => suma + stockDe(codigo) * (cantidad ?? 1), 0);
}

/** Desde el primer día del mes, para que el criterio caiga justo entre dos meses. */
function primerDiaDelMes(hoy: string, mesesAtras: number): string {
  const [anio, mes] = hoy.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(anio, mes - 1 - mesesAtras, 1)).toISOString().slice(0, 10);
}

/**
 * Sin ventas en 90 días, sin stock y no es nuevo: agotado o histórico. Es de temporada si vuelve
 * sola: no se confunde con un producto que ya no se repone. Sale del estado sola, con stock o ventas.
 */
function estadoDelProducto(
  producto: ProductoArmado,
  { venta, stock, deTemporada, hoy }: { venta?: VentaDelProducto; stock: number; deTemporada: boolean; hoy: string },
): EstadoDelProducto {
  const { enDux, creadoEl } = producto;
  const esNuevo = !creadoEl || creadoEl >= businessTime.addDays(hoy, -DIAS_DE_VENTAS);
  if (!enDux || esNuevo || stock > 0 || (venta?.centavos90 ?? 0) > 0) return "activo";
  if (venta && deTemporada) return "agotado";
  return !venta || venta.ultimaVenta < primerDiaDelMes(hoy, MESES_PARA_HISTORICO) ? "historico" : "agotado";
}

function faltantesDelProducto(
  producto: ProductoArmado,
  bulto: string | null,
  espejo: ReadonlyMap<string, CodigoDelEspejo>,
): Faltante[] {
  const { nombre, esCombo, enSheet, presentaciones, problemasDeEnvio, fotos, tieneFotoEnDux } = producto;
  const conCosto = presentaciones.find(({ tipo }) => tipo === (esCombo ? "combo" : "prenda"));
  const faltaSi = (condicion: boolean, dato: DatoQueFalta): Faltante[] =>
    condicion ? [{ dato, situacion: "falta" }] : [];
  // NO APLICA y VARIAS no son faltantes. Los combos no tienen tela, marca ni proveedor propios.
  const delSheet = (dato: DatoQueFalta, { situacion }: DatoDelSheet): Faltante[] =>
    !esCombo && enSheet && (situacion === "falta" || situacion === "no_hay_dato") ? [{ dato, situacion }] : [];

  return [
    ...faltaSi(!nombre, "nombre"),
    ...faltaSi(!((bulto && espejo.get(bulto)?.precioCentavos) ?? 0), "precio"),
    ...faltaSi(!((conCosto && espejo.get(conCosto.codigo)?.costoCentavos) ?? 0), "costo"),
    ...faltaSi(problemasDeEnvio.length > 0, "envio"),
    ...faltaSi(fotos.length === 0 && !tieneFotoEnDux, "foto"),
    ...faltaSi(!enSheet, "sheet"),
    ...delSheet("tela", producto.tela),
    ...delSheet("marca", producto.marca),
    ...delSheet("proveedor", producto.proveedor),
  ];
}

/**
 * El 80 % de la venta de los últimos 90 días es A, lo demás que vendió es B, y el resto C.
 * Los empates se ordenan por código, para que dos corridas iguales den lo mismo.
 */
function prioridades(
  productos: ProductoArmado[],
  ventas: ReadonlyMap<string, VentaDelProducto>,
): Map<string, PuestoPorVentas> {
  const montoDe = ({ codigo }: ProductoArmado) => ventas.get(codigo)?.centavos90 ?? 0;
  const orden = productos.toSorted((a, b) => montoDe(b) - montoDe(a) || a.codigo.localeCompare(b.codigo));
  const total = orden.reduce((suma, producto) => suma + montoDe(producto), 0);
  let acumulado = 0;
  return new Map(
    orden.map((producto, indice): [string, PuestoPorVentas] => {
      const monto = montoDe(producto);
      const antes = acumulado;
      acumulado += monto;
      if (monto <= 0) return [producto.codigo, { prioridad: "C", ranking: null }];
      return [producto.codigo, { prioridad: antes < total * PARETO ? "A" : "B", ranking: indice + 1 }];
    }),
  );
}

export function evaluarCatalogo({
  productos,
  ventas,
  espejo,
  hoy,
}: {
  productos: ProductoArmado[];
  /** Por producto: solo lo vendido en el último año. */
  ventas: ReadonlyMap<string, VentaDelProducto>;
  /** Por código normalizado. */
  espejo: ReadonlyMap<string, CodigoDelEspejo>;
  hoy: string;
}): Map<string, EvaluacionDelProducto> {
  const porVentas = prioridades(productos, ventas);
  return new Map(
    productos.map((producto) => {
      const venta = ventas.get(producto.codigo);
      const deTemporada = RUBROS_DE_TEMPORADA.has(producto.rubro ?? "");
      const bulto = codigoDelBulto(producto);
      const faltantes = faltantesDelProducto(producto, bulto, espejo);
      return [
        producto.codigo,
        {
          estado: estadoDelProducto(producto, { venta, stock: stockDelProducto(producto, espejo), deTemporada, hoy }),
          deTemporada,
          ...porVentas.get(producto.codigo)!,
          ventas90Centavos: venta?.centavos90 ?? 0,
          ultimaVenta: venta?.ultimaVenta ?? null,
          codigoDelBulto: bulto,
          faltantes,
          listoParaVender: faltantes.every(({ dato }) => NO_BLOQUEAN.has(dato)),
        },
      ];
    }),
  );
}
