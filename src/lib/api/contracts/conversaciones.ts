import type { ApiRequest } from "../http";
import type { Canal, ClientaRef, EstadoPedido, Segmento, Transporte, Zona } from "../types";

/** M11 · Conversaciones: bandeja propia de WhatsApp, con la ficha de la clienta al costado. */

/** bot: lo atiende el bot · esperando: derivada, espera a una persona · persona: la tomó alguien. */
export type EstadoConversacion = "bot" | "esperando" | "persona" | "cerrada";

/** RF-M11-12: el WhatsApp de ventas y el del local (post-venta) en la misma bandeja. */
export type LineaWhatsapp = "ventas" | "local";

/** RF-M11-10: en qué etapa quedó la clienta. */
export type EtapaConversacion = "consulto" | "producto" | "pedido" | "cotizo" | "cerro" | "se_cayo";

export type OrigenConversacion = {
  tipo: "anuncio" | "organico" | "recompra";
  /** Nombre del anuncio de origen (del `referral` del primer mensaje). */
  anuncio?: string;
};

type MensajeBase = { id: string; /** Fecha y hora ISO. */ enviadoEn: string };

export type MensajeConversacion =
  | (MensajeBase & {
      tipo: "texto";
      autor: "clienta" | "bot" | "persona";
      autorNombre?: string;
      texto: string;
      /** Plantilla aprobada por Meta (fuera de la ventana de 24 h). */
      plantilla?: string;
    })
  | (MensajeBase & { tipo: "nota"; autorNombre: string; texto: string })
  | (MensajeBase & {
      tipo: "sistema";
      evento:
        "anuncio" | "envio" | "pedido" | "derivacion" | "seguimiento" | "toma" | "vidriera" | "reclamo" | "cierre";
      texto: string;
    })
  | (MensajeBase & {
      tipo: "producto";
      autor: "bot" | "persona";
      sku: string;
      nombre: string;
      colores: string[];
      presentacion: string;
      precio: number;
      stockBultos: number;
      link: string;
    })
  | (MensajeBase & {
      tipo: "comprobante";
      monto: number;
      banco: string;
      titular: string;
      operacion: string;
      pedidoId: string;
      totalPedido: number;
    })
  | (MensajeBase & { tipo: "audio"; duracion: string; transcripcion: string })
  | (MensajeBase & { tipo: "adjunto"; formato: "video" | "imagen"; titulo: string; detalle: string });

export type PedidoEnFicha = {
  id: string;
  estado: EstadoPedido;
  canal: Canal;
  transporte: Transporte;
  total: number;
  creadoEn: string;
};

export type ReclamoEnFicha = {
  id: string;
  tipo: string;
  pedidoId: string;
  estado: "abierto" | "resuelto";
};

/** Ficha de la clienta que acompaña la conversación (RF-M11-02). */
export type FichaEnConversacion = {
  segmento: Segmento;
  localidad: string;
  provincia: string;
  cp: string;
  zona: Zona;
  origen: { tipo: "anuncio" | "organico" | "local" | "tiendanube"; anuncio?: string };
  clientaDesdeDias: number;
  pedidosHistoricos: number;
  totalComprado: number;
  total30d: number;
  ticketPromedio: number;
  pedidos: PedidoEnFicha[];
  reclamos: ReclamoEnFicha[];
};

export type Conversacion = {
  id: string;
  clienta: ClientaRef;
  linea: LineaWhatsapp;
  estado: EstadoConversacion;
  etapa: EtapaConversacion;
  origen: OrigenConversacion;
  asignadaA: string | null;
  sinLeer: number;
  /** Motivo de la última derivación o toma (RF-M11-11). */
  motivo: string | null;
  /** Vence la ventana de 24 h de Meta; null = cerrada (solo plantillas). */
  ventanaHasta: string | null;
  pedidoAbiertoId: string | null;
  reclamoAbierto: boolean;
  mensajes: MensajeConversacion[];
  ficha: FichaEnConversacion;
};

export type RespuestaRapida = { id: string; titulo: string; texto: string };

export type PlantillaWhatsapp = { id: string; nombre: string; categoria: "utilidad" | "marketing"; texto: string };

export type BandejaConversaciones = {
  /** Hora del servidor, para calcular "hace X" y la ventana de 24 h. */
  generadoEn: string;
  conversaciones: Conversacion[];
  respuestasRapidas: RespuestaRapida[];
  plantillas: PlantillaWhatsapp[];
  motivosToma: string[];
};

export type NuevoMensaje = { tipo: "texto" | "nota" | "plantilla"; texto: string; plantillaId?: string };

const base = (id: string) => `/conversaciones/${encodeURIComponent(id)}`;

export function conversacionesEndpoints(request: ApiRequest) {
  const post = <T>(path: string, body?: object) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

  return {
    bandeja: () => request<BandejaConversaciones>("/conversaciones"),
    tomar: (id: string, motivo: string) => post<Conversacion>(`${base(id)}/tomar`, { motivo }),
    devolver: (id: string) => post<Conversacion>(`${base(id)}/devolver`),
    cerrar: (id: string) => post<Conversacion>(`${base(id)}/cerrar`),
    leer: (id: string) => post<{ ok: true }>(`${base(id)}/leer`),
    enviar: (id: string, mensaje: NuevoMensaje) => post<Conversacion>(`${base(id)}/mensajes`, mensaje),
  };
}
