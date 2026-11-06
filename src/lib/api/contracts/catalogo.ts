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

/** Cómo está el bulto en la tienda, según la última lectura. */
export type CatalogoEnLaTienda = "publicado" | "pausado" | "no_esta";

export type CatalogoFicha = CatalogoFila & {
  /** Null: la tienda todavía no se leyó. */
  enLaTienda: CatalogoEnLaTienda | null;
  /** Después del corte, se edita en la app. */
  editable: boolean;
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
    /** Donde está el original: Drive o el store. */
    original: string;
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

/* ---- Cola de revisión ---------------------------------------------------- */

export type RevisionGrupo = "para_vender" | "historicos" | "despues";

export type RevisionBloque = { id: string; grupo: RevisionGrupo; titulo: string; ayuda: string; casos: number };

export type RevisionResumen = {
  bloques: RevisionBloque[];
  casos: number;
  /** La última importación que anduvo. */
  actualizadoEl: string | null;
};

export type RevisionCaso = {
  id: string;
  /** La llave natural: un código o un archivo de Drive. */
  clave: string;
  sku: string | null;
  nombre: string | null;
  prioridad: CatalogoPrioridad | null;
  descripcion: string;
  /** "Sheet, fila 57", "DUX", "Drive" o "En esta pantalla". */
  seCorrigeEn: string;
  /** Solo en una foto suelta. */
  foto: { nombre: string; miniatura: string; enDrive: string; sugerencias: string[] } | null;
};

/** `clave` null: los históricos confirmados en bloque, en una sola línea. */
export type RevisionDecision = {
  tipo: "foto" | "historico";
  clave: string | null;
  descripcion: string;
  quien: string;
  cuando: string;
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
  /** Por qué este chequeo todavía no dice nada. */
  aviso?: string | null;
};

/* ---- Alta --------------------------------------------------------------- */

export type CatalogoAltaOpciones = {
  rubros: {
    rubro: string;
    familia: "lenceria" | "medias";
    /** Sin prefijo no hay código sugerido: lo define VX3. */
    subrubros: { nombre: string; prefijo: string | null; proximoSku: string | null }[];
  }[];
  marcas: string[];
  /** En DUX también son proveedores ARCA, Edesur o Meta: los que tienen productos se ofrecen primero. */
  proveedores: { id: string; nombre: string; conProductos: boolean }[];
  telas: string[];
  colores: string[];
  atributos: { clave: string; label: string; opciones: string[] }[];
  /** Todos los que existen o existieron: un número no se reusa nunca (RN-03). */
  codigosUsados: string[];
  /** Dónde se ven las fotos subidas. Null: este ambiente no tiene store. */
  mediaUrl: string | null;
  escrituraEnDux: CatalogoEscrituraEnDux;
  escrituraEnLaTienda: CatalogoEscrituraEnDux;
};

/** `clave`: dónde queda en el store. La dirección completa depende del ambiente. */
export type FotoSubida = { clave: string; nombre: string; ancho: number | null; alto: number | null };

export type CatalogoAltaInput = {
  sku: string;
  rubro: string;
  subrubro: string;
  /** Sale de las partes, con la regla de nombres (RN-127), sin la cantidad. */
  nombre: string;
  /** Prenda y detalle: "TOP SEGUNDA PIEL TIRA ANCHA". */
  prenda: string;
  /** "COLORES BASICOS", "COLORES Y DISEÑOS DE LA FOTO", "COLORES SURTIDOS" o un color puntual. */
  color: string;
  copa: string;
  marca: string;
  proveedorId: string;
  tela: string;
  /** La curva: "BLANCO, NEGRO, BEIGE". */
  colores: string[];
  talles: string;
  atributos: Record<string, string>;
  /** Lo que no todos los productos tienen (RN-01). */
  opcionales: { tres?: boolean; docena?: boolean; dosDocenas?: boolean };
  costoDocena: number;
  pesoBultoKg: number;
  medidasCm: [number, number, number];
  /** En orden: la primera es la principal, la que va al frente en Tienda Nube y en DUX. */
  fotos: FotoSubida[];
};

/** La ficha para editar, después del corte. */
export type CatalogoEdicion = {
  sku: string;
  nombre: string;
  tela: string;
  colores: string;
  talles: string;
  atributos: Record<string, string>;
  pesoKg: number;
  medidasCm: [number, number, number];
  /** Las de Drive quedan como están. */
  fotosDeDrive: number;
  fotos: FotoSubida[];
  opcionesDeAtributos: { clave: string; label: string; opciones: string[] }[];
  cortado: boolean;
};

/** Lo que ya existe y se parece: se abre su ficha antes de crear otro (RN-04, RN-125). */
export type CatalogoParecido = Pick<CatalogoFila, "sku" | "nombre" | "colores" | "vigencia" | "foto" | "deTemporada">;

/** Un código de la publicación en DUX. `error` y `pendiente` se retoman: antes de crear, siempre se busca. */
export type CatalogoPasoDeDux = {
  codigo: string;
  nombre: string;
  estado: "pendiente" | "creado" | "error";
  detalle: string | null;
};

export type CatalogoBorrador = {
  id: string;
  input: CatalogoAltaInput;
  quien: string;
  cuando: string;
  /** Null: todavía no se empezó a publicar. */
  publicacion: { pasos: CatalogoPasoDeDux[]; enDux: boolean } | null;
  /** Null: todavía no se empezó a publicar en la tienda. */
  tienda: CatalogoEstadoEnLaTienda | null;
};

export type CatalogoEstadoEnLaTienda = {
  /** Null: todavía no se creó. */
  productoId: number | null;
  /** Cuántas fotos ya están. */
  fotos: number;
  visible: boolean;
  detalle: string | null;
  error: boolean;
};

/** Lo que se mandaría, para verlo antes y fuera de producción. */
export type CatalogoPedidoDeLaTienda = {
  /** Null: el rubro no tiene regla. */
  ruta: string[] | null;
  categoriaId: number | null;
  problema: string | null;
  pedido: {
    name: { es: string };
    description: { es: string };
    published: boolean;
    categories: number[];
    variants: { sku: string; price: string; weight?: number; width?: number; height?: number; depth?: number }[];
  };
  fotos: string[];
};

export type CatalogoEscrituraEnDux = { puede: boolean; motivo: string | null };

export type CatalogoAltaPaso = "dux" | "precios" | "tiendanube";

export type CatalogoAltaResultado = {
  sku: string;
  paso: CatalogoAltaPaso;
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
    revision: () => request<RevisionResumen>("/catalogo/revision"),
    revisionCasos: (query: { bloque: string; page?: number; pageSize?: number }) =>
      request<Paginated<RevisionCaso>>(`/catalogo/revision/casos${toQueryString(query)}`),
    revisionDecisiones: () => request<RevisionDecision[]>("/catalogo/revision/decisiones"),
    /** Los rubros de la maqueta: los combos y las etiquetas siguen simulados, con sus propios productos. */
    rubrosDeEjemplo: () => request<string[]>("/catalogo/ejemplo/rubros"),
    control: () => request<CatalogoControl[]>("/catalogo/control"),
    altaOpciones: () => request<CatalogoAltaOpciones>("/catalogo/alta/opciones"),
    altaBorradores: () => request<CatalogoBorrador[]>("/catalogo/alta/borradores"),
    altaParecidos: (query: { q: string; rubro?: string; subrubro?: string }) =>
      request<CatalogoParecido[]>(`/catalogo/alta/parecidos${toQueryString(query)}`),
    publicar: (input: CatalogoAltaInput, paso: CatalogoAltaPaso) =>
      request<CatalogoAltaResultado>("/catalogo/alta/publicar", {
        method: "POST",
        body: JSON.stringify({ input, paso }),
      }),
    combos: (query: CatalogoCombosQuery) => request<CatalogoCombosResultado>(`/catalogo/combos${toQueryString(query)}`),
  };
}
