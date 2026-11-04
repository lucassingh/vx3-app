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

export interface ErpGateway {
  listarItems(offset: number): Promise<PaginaDeItems>;
}
