import { toQueryString, type ApiRequest } from "../http";
import type { Kpi } from "../types";

/** M2 · Stock, compras, costos y precios. */

/* ---- Espejo de stock (RF-M2-01) ----------------------------------------- */

export type StockSync = {
  /** Fecha y hora ISO de la última lectura de DUX. */
  ultimaLectura: string;
  intervaloMin: number;
  llamadas: number;
  codigos: number;
  duracionS: number;
  errores24h: number;
};

export type StockEstado = "agotado" | "critico" | "ok" | "sobrestock" | "sin_rotacion";

export type StockFila = {
  sku: string;
  nombre: string;
  rubro: string;
  colores: string[];
  bultoLabel: string;
  prendasPorBulto: number;
  stockPrendas: number;
  reservadoPrendas: number;
  disponiblePrendas: number;
  disponibleBultos: number;
  /** "47 prendas = 7 medias docenas y 5 sueltas". */
  equivalencia: string;
  ventas30dBultos: number;
  /** Días que alcanza el disponible al ritmo de los últimos 30 días; null sin ventas. */
  diasStock: number | null;
  estado: StockEstado;
};

export type StockQuery = {
  q?: string;
  rubro?: string;
  estado?: StockEstado;
};

/** Diferencias que detecta el armado: figura en DUX y no está en góndola (RF-M2-12). */
export type StockDiferencia = {
  id: string;
  sku: string;
  nombre: string;
  duxPrendas: number;
  contadoPrendas: number;
  detectadoEn: string;
  /** Fecha y hora ISO. */
  detectadoAt: string;
  causa: string;
  estado: "pendiente" | "propuesto";
};

/* ---- Margen y precios (RF-M2-04 a RF-M2-07) ----------------------------- */

export type MargenBajoPiso = {
  sku: string;
  codigo: string;
  nombre: string;
  proveedor: string;
  costoDocenaAnterior: number;
  costoDocenaNuevo: number;
  precioActual: number;
  precioPiso: number;
  margenActual: number;
  margenObjetivo: number;
  motivo: string;
};

export type MargenControl = {
  /** Fecha y hora ISO del último control automático. */
  revisadoAt: string;
  productosControlados: number;
  margenPromedio: number;
  bajoPiso: MargenBajoPiso[];
};

export type CapaCosto = {
  sku: string;
  nombre: string;
  costoDocenaViejo: number;
  costoDocenaNuevo: number;
  prendasIngresadas: number;
  prendasRestantes: number;
  precioActual: number;
  precioAlAgotarse: number;
  diasEstimados: number;
};

export type CoeficientePrecio = {
  presentacion: string;
  formula: string;
  coeficiente: number;
  listas: string;
};

export type CoeficientesPrecio = {
  lenceria: CoeficientePrecio[];
  medias: CoeficientePrecio[];
  redondeo: number;
};

export type EtiquetasResultado = { etiquetas: number; sinPrecio: number; archivo: string };

/* ---- Compras (RF-M2-02, RF-M2-03, RF-M2-08) ----------------------------- */

export type RecepcionRenglon = {
  id: string;
  codigo: string;
  sku: string;
  nombre: string;
  colores: string[];
  familia: "lenceria" | "medias";
  prendasPorBulto: number;
  boletaBultos: number;
  contadoBultos: number;
  nuevo: boolean;
  costoDocenaActual: number;
  /** Si el proveedor cambió el costo en esta boleta. */
  costoDocenaNuevo: number | null;
};

export type Recepcion = {
  id: string;
  proveedorId: string;
  proveedor: string;
  proveedorTipo: "fabricante" | "importador" | "mayorista";
  boleta: string;
  /** Fecha ISO (YYYY-MM-DD). */
  fecha: string;
  recibidoPor: string;
  /** Quiénes pueden revisar y firmar: cualquiera menos quien recibió (RN-37). */
  firmantes: string[];
  /** Quien firmó, cuando ya se cargó en DUX. */
  firmadoPor: string | null;
  renglones: RecepcionRenglon[];
};

export type RecepcionCarga = {
  renglones: { id: string; contadoBultos: number; costoDocenaNuevo: number | null }[];
  firmadoPor: string;
};

export type RecepcionResultado = {
  comprobante: string;
  bultos: number;
  preciosActualizados: number;
};

export type CompraHistorial = {
  id: string;
  proveedor: string;
  boleta: string;
  /** Fecha ISO (YYYY-MM-DD). */
  fecha: string;
  bultos: number;
  monto: number;
  faltantes: number;
  estado: "cargada" | "con_faltantes" | "en_revision";
  firmadaPor: string | null;
};

/* ---- Proveedores (RF-M2-11) --------------------------------------------- */

export type StockProveedor = {
  id: string;
  nombre: string;
  tipo: "fabricante" | "importador" | "mayorista";
  rubros: string[];
  frecuencia: string;
  condiciones: string;
  plazoEntregaDias: number;
  ultimaCompraDias: number;
  compras30d: number;
  notas: string;
  productos: { sku: string; nombre: string; colores: string[]; costoDocena: number; disponibleBultos: number }[];
};

export function stockEndpoints(request: ApiRequest) {
  return {
    sync: () => request<StockSync>("/stock/sync"),
    kpis: () => request<Kpi[]>("/stock/kpis"),
    espejo: (query: StockQuery = {}) => request<StockFila[]>(`/stock/espejo${toQueryString(query)}`),
    diferencias: () => request<StockDiferencia[]>("/stock/diferencias"),
    proponerAjuste: (id: string) =>
      request<StockDiferencia>(`/stock/diferencias/${encodeURIComponent(id)}/ajuste`, { method: "POST" }),
    margenKpis: () => request<Kpi[]>("/stock/margen/kpis"),
    margen: () => request<MargenControl>("/stock/margen"),
    corregirPrecio: (sku: string) =>
      request<{ sku: string; codigo: string; precio: number }>(`/stock/margen/${encodeURIComponent(sku)}/corregir`, {
        method: "POST",
      }),
    capas: () => request<CapaCosto[]>("/stock/capas"),
    coeficientes: () => request<CoeficientesPrecio>("/stock/coeficientes"),
    etiquetas: (rubro?: string) =>
      request<EtiquetasResultado>("/stock/etiquetas", {
        method: "POST",
        body: JSON.stringify({ rubro }),
      }),
    recepcion: () => request<Recepcion>("/stock/recepcion"),
    cargarRecepcion: (carga: RecepcionCarga) =>
      request<RecepcionResultado>("/stock/recepcion/cargar", {
        method: "POST",
        body: JSON.stringify(carga),
      }),
    compras: () => request<CompraHistorial[]>("/stock/compras"),
    proveedores: () => request<StockProveedor[]>("/stock/proveedores"),
  };
}
