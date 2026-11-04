import type { Conversacion, MensajeConversacion } from "@/lib/api/types";
import { formatCurrency, formatRelativeTime, formatTime } from "@/lib/format";

/**
 * Datos de la bandeja listos para mostrar. El servidor arma la vista inicial
 * (así no hay diferencias al hidratar); después de una acción, el cliente
 * vuelve a armar solo la conversación que cambió.
 */

export type MensajeView = MensajeConversacion & {
  /** "14:35" o "27 oct · 14:35" si no es de hoy. */
  hora: string;
  /** Montos ya formateados (producto y comprobante). */
  montos?: { precio?: string; monto?: string; total?: string; diferencia?: string };
};

export type ConversacionView = Omit<Conversacion, "mensajes"> & {
  mensajes: MensajeView[];
  ultimo: { texto: string; hace: string; deClienta: boolean };
  ventana: { abierta: boolean; label: string };
  fichaLabels: {
    total30d: string;
    totalComprado: string;
    ticketPromedio: string;
    pedidos: Record<string, { total: string; fecha: string }>;
  };
};

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "numeric", month: "short" });

function horaDe(iso: string, now: number) {
  const date = new Date(iso);
  const day = dayKey.format(date);
  return day === dayKey.format(new Date(now)) ? formatTime(iso) : `${day.replace(".", "")} · ${formatTime(iso)}`;
}

function previewDe(mensaje: MensajeConversacion) {
  switch (mensaje.tipo) {
    case "texto":
      return mensaje.plantilla ? `Plantilla: ${mensaje.texto}` : mensaje.texto;
    case "nota":
      return `Nota interna: ${mensaje.texto}`;
    case "sistema":
      return mensaje.texto;
    case "producto":
      return `Producto: ${mensaje.nombre}`;
    case "comprobante":
      return `Comprobante por ${formatCurrency(mensaje.monto)}`;
    case "audio":
      return `Audio (${mensaje.duracion})`;
    case "adjunto":
      return mensaje.titulo;
  }
}

export function isFromClienta(mensaje: MensajeConversacion) {
  return (
    (mensaje.tipo === "texto" && mensaje.autor === "clienta") ||
    mensaje.tipo === "audio" ||
    mensaje.tipo === "comprobante" ||
    mensaje.tipo === "adjunto"
  );
}

function ventanaLabel(ventanaHasta: string | null, now: number) {
  if (!ventanaHasta) return { abierta: false, label: "Ventana de 24 h cerrada" };
  const minutos = Math.max(0, Math.round((new Date(ventanaHasta).getTime() - now) / 60_000));
  if (minutos <= 0) return { abierta: false, label: "Ventana de 24 h cerrada" };
  const resto = minutos >= 60 ? `${Math.floor(minutos / 60)} h` : `${minutos} min`;
  return { abierta: true, label: `Ventana abierta · vence en ${resto}` };
}

export function toConversacionView(conversacion: Conversacion, now: number): ConversacionView {
  const mensajes: MensajeView[] = conversacion.mensajes.map((mensaje) => {
    const hora = horaDe(mensaje.enviadoEn, now);
    if (mensaje.tipo === "producto") {
      return { ...mensaje, hora, montos: { precio: formatCurrency(mensaje.precio) } };
    }
    if (mensaje.tipo === "comprobante") {
      const diferencia = mensaje.totalPedido - mensaje.monto;
      return {
        ...mensaje,
        hora,
        montos: {
          monto: formatCurrency(mensaje.monto),
          total: formatCurrency(mensaje.totalPedido),
          diferencia: diferencia !== 0 ? formatCurrency(Math.abs(diferencia)) : undefined,
        },
      };
    }
    return { ...mensaje, hora };
  });

  const ultimoMensaje =
    conversacion.mensajes.findLast((mensaje) => mensaje.tipo !== "sistema") ?? conversacion.mensajes.at(-1);
  const actividad = conversacion.mensajes.at(-1)?.enviadoEn;

  const pedidos: ConversacionView["fichaLabels"]["pedidos"] = {};
  for (const pedido of conversacion.ficha.pedidos) {
    pedidos[pedido.id] = {
      total: formatCurrency(pedido.total),
      fecha: formatRelativeTime(pedido.creadoEn, now),
    };
  }

  return {
    ...conversacion,
    mensajes,
    ultimo: {
      texto: ultimoMensaje ? previewDe(ultimoMensaje) : "",
      hace: actividad ? formatRelativeTime(actividad, now) : "",
      deClienta: ultimoMensaje ? isFromClienta(ultimoMensaje) : false,
    },
    ventana: ventanaLabel(conversacion.ventanaHasta, now),
    fichaLabels: {
      total30d: formatCurrency(conversacion.ficha.total30d),
      totalComprado: formatCurrency(conversacion.ficha.totalComprado),
      ticketPromedio: formatCurrency(conversacion.ficha.ticketPromedio),
      pedidos,
    },
  };
}
