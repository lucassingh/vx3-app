import "server-only";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { serverEnv } from "@/env";
import { logger } from "@/lib/logger";

/**
 * El store público de archivos (`infraestructura.md` §10). La base guarda solo la clave de cada
 * archivo: la dirección completa sale de acá, y cada ambiente tiene su store.
 */
export function mediaUrl(clave: string): string | null {
  const base = serverEnv().MEDIA_URL;
  return base ? `${base.replace(/\/$/, "")}/${clave}` : null;
}

/** La dirección base del store, si este ambiente lo tiene conectado. */
export function baseDelStore(): string | null {
  const { MEDIA_URL, BLOB_READ_WRITE_TOKEN } = serverEnv();
  return MEDIA_URL && BLOB_READ_WRITE_TOKEN ? MEDIA_URL.replace(/\/$/, "") : null;
}

const PERMISO_MS = 10 * 60 * 1000;
const UN_ANO_EN_SEGUNDOS = 365 * 24 * 60 * 60;

/**
 * El permiso para que el navegador suba un archivo directo al store: así no aplica el límite de
 * 4,5 MB de las funciones. El tipo y el tamaño los exige el store, no el navegador. Quién puede
 * pedirlo lo resuelve el despachador de la API.
 */
export async function permisoDeSubida(
  request: Request,
  body: HandleUploadBody,
  {
    claveValida,
    tipos,
    maxBytes,
  }: { claveValida: (clave: string) => boolean; tipos: readonly string[]; maxBytes: number },
) {
  return handleUpload({
    request,
    body,
    token: serverEnv().BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (clave) => {
      if (!claveValida(clave)) throw new Error("Esa foto no se puede subir ahí.");
      return {
        allowedContentTypes: [...tipos],
        maximumSizeInBytes: maxBytes,
        addRandomSuffix: true,
        validUntil: Date.now() + PERMISO_MS,
        // Con el sufijo al azar, una foto nunca cambia en su dirección.
        cacheControlMaxAge: UN_ANO_EN_SEGUNDOS,
      };
    },
  });
}

/** Limpieza: si falla, queda un archivo sin uso en el store, que no le hace mal a nadie. Nunca frena lo que se estaba haciendo. */
export async function borrarDelStore(claves: readonly string[]): Promise<void> {
  if (claves.length === 0) return;
  const { BLOB_READ_WRITE_TOKEN: token } = serverEnv();
  const direcciones = claves.flatMap((clave) => mediaUrl(clave) ?? []);
  if (!token || direcciones.length === 0) return;
  try {
    await del(direcciones, { token });
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : "desconocido" },
      "no se pudieron borrar archivos del store",
    );
  }
}
