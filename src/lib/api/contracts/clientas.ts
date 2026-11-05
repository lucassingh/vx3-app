import { toQueryString, type ApiRequest } from "../http";
import type { Canal, EstadoPedido, Paginated, Segmento, Zona } from "../types";

/** M12 · Clientes y recompra: la ficha única por teléfono normalizado y la lista del día. */

export type OrigenClientaTipo = "anuncio" | "organico" | "local" | "tiendanube" | "sin_dato";

/** Fila de la lista de clientas. */
export type ClientaFila = {
  id: string;
  nombre: string;
  telefono: string;
  localidad: string | null;
  provincia: string | null;
  /** La zona llega con el cotizador (2.1). */
  zona: Zona | null;
  /** Null: no tiene compras en lo que está leído. */
  segmento: Segmento | null;
  origen: OrigenClientaTipo;
  /** Nombre del anuncio de origen, o "Orgánico", "Local", "Tienda Nube", "Sin dato". */
  origenLabel: string;
  pedidos: number;
  totalComprado: number;
  /** Margen histórico estimado, en pesos. */
  margen: number;
  /** Null: no tiene compras en lo que está leído. */
  ultimaCompraDias: number | null;
  cicloDias: number | null;
};

export type ClientasQuery = {
  q?: string;
  segmento?: Segmento;
  page?: number;
  pageSize?: number;
};

export type SegmentoResumen = {
  segmento: Segmento;
  clientas: number;
  margen: number;
  /** Parte del margen total, como fracción. */
  participacion: number;
};

/** Cuánto alcanzan las fichas. */
export type ClientasCobertura = {
  /** Parte de la venta de los últimos 12 meses que tiene una clienta identificada, como fracción. */
  ventaIdentificada: number;
  /** Fichas con teléfono, pero sin compras en lo que está leído: no tienen segmento. */
  sinCompras: number;
};

export type FichaEventoTipo = "pedido" | "conversacion" | "envio" | "cobro" | "reclamo";

export type FichaEvento = {
  id: string;
  tipo: FichaEventoTipo;
  titulo: string;
  detalle: string;
  /** Fecha y hora ISO. */
  fecha: string;
  monto?: number;
  estado?: EstadoPedido;
  canal?: Canal;
};

/** Cómo figura la clienta en cada sistema; se unen por los últimos 10 dígitos (RN-90, RN-91). */
export type IdentidadSistema = {
  sistema: "WhatsApp" | "DUX" | "Tienda Nube" | "Local";
  valor: string;
  detalle: string;
};

export type FichaClienta = ClientaFila & {
  cp: string | null;
  primeraCompraDias: number | null;
  ticketPromedio: number;
  /** Teléfono normalizado: últimos 10 dígitos. */
  telefonoNormalizado: string;
  identidades: IdentidadSistema[];
  anuncioOrigen: { id: string; nombre: string; campana: string; sku: string | null } | null;
  skusFrecuentes: { sku: string; nombre: string; colores: string[]; veces: number }[];
  eventos: FichaEvento[];
};

export type DuplicadoClienta = {
  id: string;
  clientaId: string;
  nombre: string;
  telefonoNormalizado: string;
  motivo: string;
  registros: { sistema: string; nombre: string; detalle: string }[];
};

export type RecompraTipo = "recompra" | "reactivacion";

/** Los cuatro mensajes de la secuencia, y después la reactivación. */
export type RecompraEtapa = "m1" | "m2" | "m3" | "m4" | "reactivacion" | "alto_valor";

export type RecompraEstado = "pendiente" | "contactada" | "respondio" | "pospuesta";

export type ClientaParaRecompra = {
  id: string;
  nombre: string;
  telefono: string;
  /** Solo dígitos, para armar el link de wa.me. */
  telefonoWa: string;
  segmento: Segmento | null;
  tipo: RecompraTipo;
  etapa: RecompraEtapa;
  etapaLabel: string;
  motivo: string;
  ultimaCompraDias: number;
  cicloDias: number | null;
  totalComprado: number;
  ultimoPedido: { id: string; total: number; resumen: string; haceDias: number } | null;
  skus: { sku: string; nombre: string; colores: string[] }[];
  /** Con [corchetes] donde falta un dato: así no se puede mandar. */
  mensaje: string;
  /** Algo que conviene saber antes de escribirle. */
  nota?: string;
  estado: RecompraEstado;
};

/** Contactada hace menos de una semana: si responde, sale de la secuencia. */
export type RecompraEsperando = {
  id: string;
  nombre: string;
  telefono: string;
  etapaLabel: string;
  contactadaHaceDias: number;
  estado: "contactada" | "respondio";
};

export type ListaDeRecompra = {
  hoy: ClientaParaRecompra[];
  esperando: RecompraEsperando[];
  /** A cuántas más les toca, y no entraron por el tope. */
  enCola: number;
  tope: number;
};

/** "Compraron" es un conteo, no un efecto: algunas iban a comprar igual. */
export type RecompraResultados = {
  contactadas: number;
  compraron: number;
  ventas: number;
  margen: number;
};

export function clientasEndpoints(request: ApiRequest) {
  return {
    list: (query: ClientasQuery = {}) => request<Paginated<ClientaFila>>(`/clientas${toQueryString(query)}`),
    segmentos: () => request<SegmentoResumen[]>("/clientas/segmentos"),
    cobertura: () => request<ClientasCobertura>("/clientas/cobertura"),
    get: (id: string) => request<FichaClienta>(`/clientas/${encodeURIComponent(id)}`),
    duplicados: () => request<DuplicadoClienta[]>("/clientas/duplicados"),
    recompra: () => request<ListaDeRecompra>("/clientas/recompra"),
    recompraResultados: () => request<RecompraResultados>("/clientas/recompra/resultados"),
    marcarRecompra: (id: string, body: { estado: RecompraEstado; mensaje?: string }) =>
      request<{ estado: RecompraEstado }>(`/clientas/recompra/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  };
}
