/**
 * Lo que el dominio le pide al ERP (`tecnica.md` §4.1): el espejo depende de esta
 * interfaz y no de DUX. Lo que dice cada proveedor se traduce en su adaptador
 * (src/integrations/dux).
 */

export type ErpPrecio = { listaId: number; lista: string; centavos: number };

export type ErpItem = {
  /** El código tal como lo tiene el ERP: sirve para volver a pedírselo. */
  codigo: string;
  nombre: string;
  rubro: string | null;
  subrubro: string | null;
  marca: string | null;
  /** El que pide el ERP para escribir: en muchas marcas no es su nombre. */
  marcaCodigo: string | null;
  proveedorId: number | null;
  proveedor: string | null;
  costoCentavos: number;
  precios: ErpPrecio[];
  /** Sumados entre depósitos y variantes. */
  stockReal: number;
  stockReservado: number;
  stockDisponible: number;
  habilitado: boolean;
  codigoExterno: string | null;
  imagenUrl: string | null;
  /** "2025-10-09". */
  creadoEl: string;
};

export type PaginaDeItems = { items: ErpItem[]; total: number; hayMas: boolean };

/** Lo que el alta ofrece, y lo que el ERP pide por ID al crear un producto. */
export type ErpReferencias = {
  rubros: { id: number; nombre: string }[];
  subrubros: { id: number; rubroId: number; nombre: string }[];
  proveedores: { id: number; nombre: string; habilitado: boolean }[];
  listas: { id: number; nombre: string; habilitado: boolean }[];
};

/** Los códigos que existen en el ERP, habilitados o no. */
export type PaginaDeCodigos = { codigos: string[]; hayMas: boolean };

export type ErpLinea = {
  codigo: string;
  nombre: string;
  cantidad: number;
  precioCentavos: number;
  descuentoPct: number;
  ivaPct: number;
  /** El congelado al vender, no el vigente (RN-109). */
  costoCentavos: number;
};

/** Sin el nombre ni los documentos de la clienta: se llega a ella por su ID. */
export type ErpComprobante = {
  id: number;
  sucursal: number;
  tipo: string;
  letra: string;
  puntoDeVenta: string;
  /** DUX tiene facturas sin número. */
  numero: number | null;
  /** "2026-11-03". */
  fecha: string;
  clienteId: number | null;
  pedido: string | null;
  totalCentavos: number;
  anulado: boolean;
  lineas: ErpLinea[];
};

export type PedidoDeComprobantes = { sucursal: number; desde: string; hasta: string; offset: number };

export type PaginaDeComprobantes = { comprobantes: ErpComprobante[]; total: number; hayMas: boolean };

/** Sin documento ni domicilio: no hacen falta y no entran a la app. */
export type ErpClienta = {
  id: number;
  nombre: string;
  /** Cuando el ERP lo tiene aparte del nombre completo. */
  nombrePila: string | null;
  telefono: string | null;
  email: string | null;
  provincia: string | null;
  localidad: string | null;
  habilitada: boolean;
  /** "2025-10-09". */
  creadaEl: string | null;
};

export type PaginaDeClientas = { clientas: ErpClienta[]; hayMas: boolean };

export interface ErpGateway {
  listarCodigos(offset: number): Promise<PaginaDeCodigos>;
  listarReferencias(): Promise<ErpReferencias>;
  /** Un código exacto. Null si el ERP no lo tiene. */
  buscarItem(codigo: string): Promise<{ codigo: string; nombre: string } | null>;
  listarItems(offset: number): Promise<PaginaDeItems>;
  listarClientas(offset: number): Promise<PaginaDeClientas>;
  listarComprobantes(pedido: PedidoDeComprobantes): Promise<PaginaDeComprobantes>;
}
