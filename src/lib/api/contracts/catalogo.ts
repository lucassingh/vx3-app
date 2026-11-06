import { toQueryString, type ApiRequest } from "../http";
import type { Kpi, Paginated } from "../types";

/** M1 · Catálogo maestro (PIM): producto, salud, alta y combos. */

/** Sale de las ventas y el stock (RN-125). Un histórico solo se ve buscándolo. */
export type CatalogoVigencia = "activo" | "agotado" | "historico";
export type CatalogoPrioridad = "A" | "B" | "C";
export type CatalogoSalud = "listo" | "no_listo";

/** Lo que le falta a un producto (RN-124). `no_hay_dato` es definitivo. */
export type CatalogoFaltante = {
  dato: string;
  situacion: "falta" | "no_hay_dato";
  /** Sin esto no se puede vender. Tela, marca y proveedor son deseables. */
  bloquea: boolean;
  /** "Sheet, fila 57", "DUX" o "Drive". */
  seCorrigeEn: string;
};

export type CatalogoFila = {
  sku: string;
  nombre: string;
  rubro: string | null;
  subrubro: string | null;
  marca: string | null;
  colores: string[];
  vigencia: CatalogoVigencia;
  deTemporada: boolean;
  prioridad: CatalogoPrioridad;
  /** Miniatura: de Drive; si no hay, la de DUX. */
  foto: string | null;
  /** El código que se vende al por mayor (RN-101). Null: DUX no lo tiene. */
  bulto: { codigo: string; label: string; precio: number } | null;
  bultosDisponibles: number;
  listoParaVender: boolean;
  faltantes: CatalogoFaltante[];
};

export type CatalogoFicha = CatalogoFila & {
  tela: string | null;
  /** Como está en el Sheet: "BLANCO, NEGRO Y BEIGE". */
  coloresTexto: string | null;
  talles: string | null;
  /** El último: un producto puede venir de varios (RN-128). */
  proveedor: string | null;
  atributos: { label: string; valor: string }[];
  /** Largo, ancho y alto. */
  medidasCm: [number, number, number] | null;
  pesoKg: number | null;
  /** Puesto por ventas de los últimos 90 días. */
  ranking: number | null;
  ultimaVenta: string | null;
  enSheet: boolean;
  filaDelSheet: number | null;
  enDux: boolean;
  presentaciones: {
    codigo: string;
    label: string;
    prendas: number | null;
    precio: number;
    listas: string[];
    esBulto: boolean;
    disponible: number;
    enDux: boolean;
  }[];
  fotos: {
    id: string;
    nombre: string;
    miniatura: string;
    enDrive: string;
    ancho: number | null;
    alto: number | null;
  }[];
};

export type CatalogoQuery = {
  q?: string;
  rubro?: string;
  subrubro?: string;
  marca?: string;
  tela?: string;
  talle?: string;
  color?: string;
  proveedor?: string;
  estado?: CatalogoVigencia;
  salud?: CatalogoSalud;
};

/** `valor` es lo que va en la URL: sin tildes ni mayúsculas. */
export type CatalogoFaceta = { valor: string; etiqueta: string; productos: number };

export type CatalogoFacetas = {
  rubros: CatalogoFaceta[];
  subrubros: CatalogoFaceta[];
  marcas: CatalogoFaceta[];
  telas: CatalogoFaceta[];
  talles: CatalogoFaceta[];
  colores: CatalogoFaceta[];
  proveedores: CatalogoFaceta[];
};

/* ---- La maqueta del alta, los combos y el control final: se reemplazan en la 1.9 ---- */

export type CatalogoEstado = "borrador" | "listo" | "publicado" | "pausado";

export type CatalogoPresentacion = {
  /** Código de DUX: SKU, SKU-6, SKU-12… */
  codigo: string;
  label: string;
  prendas: number;
  precio: number;
  costo: number;
  /** Listas de precios donde se carga (RN-95). */
  listas: string[];
  /** La que compra el mayorista (RN-20b). */
  esBulto: boolean;
};

export type CatalogoFoto = {
  tipo: "colores" | "comercial" | "textura" | "detalle";
  label: string;
  cargada: boolean;
};

export type CatalogoProducto = {
  sku: string;
  nombre: string;
  rubro: string;
  subrubro: string;
  marca: string | null;
  proveedorId: string;
  proveedor: string;
  familia: "lenceria" | "medias";
  tela: string | null;
  colores: string[];
  talles: string;
  aclaracion: string;
  estado: CatalogoEstado;
  /** Lo que le falta o está mal (RF-M1-10). */
  faltantes: string[];
  completoParaBot: boolean;
  publicado: { dux: boolean; tiendaNube: boolean; meta: boolean };
  bulto: { codigo: string; label: string; precio: number };
  bultosDisponibles: number;
  ventas30dBultos: number;
  costoDocena: number;
  /** Margen del bulto sobre el precio (fracción). */
  margenBulto: number;
  pesoBultoKg: number;
  medidasCm: [number, number, number];
  stockPrendas: number;
  reservadoPrendas: number;
  presentaciones: CatalogoPresentacion[];
  fotos: CatalogoFoto[];
  /** Descripción armada con los atributos (RN-103), generada con IA y revisada (RF-M1-11). */
  descripcion: { texto: string; revisada: boolean };
};

/** Control final automático (RF-M1-09): cada chequeo con lo que falla. */
export type CatalogoControl = {
  id: string;
  label: string;
  regla: string;
  revisados: number;
  fallas: { sku: string; nombre: string; detalle: string }[];
};

/* ---- Alta --------------------------------------------------------------- */

export type CatalogoAltaOpciones = {
  rubros: {
    rubro: string;
    familia: "lenceria" | "medias";
    subrubros: { nombre: string; prefijo: string; proximoSku: string; nombreBase: string }[];
  }[];
  marcas: string[];
  proveedores: { id: string; nombre: string }[];
  telas: string[];
  colores: string[];
  aclaraciones: string[];
  /** SKUs existentes (para validar repetidos y para el reciclado de SKU). */
  skus: { sku: string; nombre: string; rubro: string }[];
};

export type CatalogoAltaInput = {
  sku: string;
  rubro: string;
  subrubro: string;
  nombre: string;
  marca: string;
  proveedorId: string;
  tela: string;
  colores: string[];
  talles: string;
  aclaracion: string;
  costoDocena: number;
  pesoBultoKg: number;
  medidasCm: [number, number, number];
};

export type CatalogoAltaPaso = "dux" | "precios" | "tiendanube";

export type CatalogoAltaResultado = {
  sku: string;
  paso: CatalogoAltaPaso | "borrador";
  detalle: string;
};

/* ---- Combos (RN-108) ---------------------------------------------------- */

export type CatalogoCombosModo = "margen" | "liquidar_stock" | "liquidar_categoria";

export type CatalogoCombosQuery = {
  modo: CatalogoCombosModo;
  categoria?: string;
  /** SKUs que tienen que estar en todos los combos, separados por coma. */
  forzar?: string;
};

export type CatalogoCombo = {
  id: string;
  nombre: string;
  items: {
    sku: string;
    codigo: string;
    nombre: string;
    colores: string[];
    prendas: number;
    precio: number;
    costo: number;
  }[];
  bultos: number;
  prendas: number;
  /** Suma de los bultos redondeada hacia arriba a $500 (RN-96). */
  total: number;
  costo: number;
  /** Con el costo vigente del stock (RN-109). */
  margen: number;
  avisoMargen: boolean;
};

export type CatalogoCombosResultado = {
  combos: CatalogoCombo[];
  quiebres: { sku: string; nombre: string; bultos: number; rotacionSemanal: number }[];
  sospechosos: { sku: string; nombre: string; margenAparente: number; margenReal: number; motivo: string }[];
};

export function catalogoEndpoints(request: ApiRequest) {
  return {
    kpis: () => request<Kpi[]>("/catalogo/kpis"),
    facetas: (query: CatalogoQuery = {}) => request<CatalogoFacetas>(`/catalogo/facetas${toQueryString(query)}`),
    productos: (query: CatalogoQuery & { page?: number; pageSize?: number } = {}) =>
      request<Paginated<CatalogoFila>>(`/catalogo/productos${toQueryString(query)}`),
    producto: (sku: string) => request<CatalogoFicha>(`/catalogo/productos/${encodeURIComponent(sku)}`),
    /** Los rubros de la maqueta: los combos y las etiquetas siguen simulados, con sus propios productos. */
    rubrosDeEjemplo: () => request<string[]>("/catalogo/ejemplo/rubros"),
    control: () => request<CatalogoControl[]>("/catalogo/control"),
    altaOpciones: () => request<CatalogoAltaOpciones>("/catalogo/alta/opciones"),
    publicar: (input: CatalogoAltaInput, paso: CatalogoAltaPaso) =>
      request<CatalogoAltaResultado>("/catalogo/alta/publicar", {
        method: "POST",
        body: JSON.stringify({ input, paso }),
      }),
    guardarBorrador: (input: Partial<CatalogoAltaInput>) =>
      request<CatalogoAltaResultado>("/catalogo/alta/borrador", {
        method: "POST",
        body: JSON.stringify({ input }),
      }),
    combos: (query: CatalogoCombosQuery) => request<CatalogoCombosResultado>(`/catalogo/combos${toQueryString(query)}`),
  };
}
