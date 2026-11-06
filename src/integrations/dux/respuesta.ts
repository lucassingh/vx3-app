import type { RespuestaHttp, Veredicto } from "@/lib/http-client";

/**
 * Cómo leer una respuesta de DUX (`solucion_doc/04` §1.1 y §1.6). El código HTTP no
 * alcanza: DUX responde 200 con un mensaje en vez de datos, y 400 a requests válidos.
 */

type Cuerpo = {
  message?: unknown;
  error?: { mensaje?: unknown; detalle?: unknown };
  id_solicitud?: unknown;
  datos?: unknown;
  results?: unknown;
};

const FORMATO_DESCONOCIDO = /formato desconocido/i;
const EMPRESA_NO_ENCONTRADA = /empresa no encontrada/i;

function mensajeDe(cuerpo: Cuerpo): string | null {
  const mensaje = cuerpo.error?.mensaje ?? cuerpo.message;
  return typeof mensaje === "string" ? mensaje : null;
}

/** Qué campo rechazó y por qué. Sin el valor: puede traer datos de la respuesta. */
function camposRechazados(cuerpo: Cuerpo): string {
  const { detalle } = cuerpo.error ?? {};
  if (!Array.isArray(detalle)) return "";
  const campos = (detalle as { campo?: unknown; problema?: unknown }[])
    .filter(({ campo, problema }) => typeof campo === "string" && typeof problema === "string")
    .map(({ campo, problema }) => `${String(campo)}: ${String(problema)}`);
  return campos.length > 0 ? ` (${campos.join("; ")})` : "";
}

export function clasificarRespuestaDux({ status, cuerpo }: RespuestaHttp): Veredicto {
  const objeto: Cuerpo = typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {};
  const mensaje = mensajeDe(objeto);
  const contexto = { idSolicitud: objeto.id_solicitud };

  // Responde esto a requests válidos, con 200 o con 400: se arregla volviendo a pedir.
  if (mensaje && FORMATO_DESCONOCIDO.test(mensaje)) return { tipo: "reintentar", motivo: mensaje, contexto };
  if (status === 429 || status >= 500) return { tipo: "reintentar", motivo: `HTTP ${status}`, contexto };

  if (status === 401)
    return { tipo: "error", mensaje: "DUX rechazó el token: revisá que esté bien cargado.", contexto };
  if (status === 403) {
    return { tipo: "error", mensaje: "DUX rechazó el pedido (403): puede ser el token o su firewall.", contexto };
  }
  if (status >= 400) {
    const detalle = mensaje?.replace(/\.$/, "") ?? `HTTP ${status}`;
    return { tipo: "error", mensaje: `DUX rechazó el pedido: ${detalle}${camposRechazados(objeto)}.`, contexto };
  }

  // Con un ID de empresa equivocado responde 200: lo único que lo delata es el cuerpo.
  if (mensaje && EMPRESA_NO_ENCONTRADA.test(mensaje)) {
    return { tipo: "error", mensaje: "DUX no encuentra la empresa: revisá DUX_ID_EMPRESA.", contexto };
  }
  if (objeto.datos === undefined && objeto.results === undefined) {
    return { tipo: "reintentar", motivo: mensaje ?? "respondió sin datos", contexto };
  }
  return { tipo: "ok" };
}
