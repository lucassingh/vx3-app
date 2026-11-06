/**
 * Reglas de las fotos nuevas del catálogo. Las usan el navegador, para avisar antes de subir, y la
 * app, al dar el permiso: el store las vuelve a exigir, así que no alcanza con saltearse el formulario.
 */

/** Las que Tienda Nube y DUX muestran. HEIC, el de los iPhone, no: hay que exportarla como JPG. */
export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"];

export const FOTO_MAX_MB = 10;
export const FOTO_MAX_BYTES = FOTO_MAX_MB * 1024 * 1024;

/** Hoy el producto con más fotos tiene 8, y la mitad tiene 2 o menos (06/11). */
export const FOTOS_POR_PRODUCTO = 10;

/** Dónde queda una foto en el store. Lo demás del store no se puede pedir ni borrar desde el alta. */
export const CLAVE_DE_FOTO = /^catalogo\/[\w.-]+$/;

export function problemaDeLaFoto({ type, size }: { type: string; size: number }): string | null {
  if (!TIPOS_DE_FOTO.includes(type))
    return "Tiene que ser JPG, PNG o WebP. Las de iPhone se exportan primero como JPG.";
  if (size > FOTO_MAX_BYTES) return `Pesa más de ${FOTO_MAX_MB} MB.`;
  if (size === 0) return "El archivo está vacío.";
  return null;
}

/** Sin tildes ni espacios: es parte de una URL. El store le agrega un sufijo al azar, así que no se pisan. */
export function claveParaSubir(nombreDelArchivo: string): string {
  const punto = nombreDelArchivo.lastIndexOf(".");
  const limpiar = (texto: string) =>
    texto
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .toLowerCase();
  const base = limpiar(punto > 0 ? nombreDelArchivo.slice(0, punto) : nombreDelArchivo) || "foto";
  const extension = punto > 0 ? limpiar(nombreDelArchivo.slice(punto + 1)) : "";
  return `catalogo/${base}${extension ? `.${extension}` : ""}`;
}

export function moverFoto<T>(fotos: readonly T[], indice: number, destino: number): T[] {
  const copia = [...fotos];
  if (indice < 0 || indice >= copia.length || destino < 0 || destino >= copia.length) return copia;
  const [foto] = copia.splice(indice, 1);
  copia.splice(destino, 0, foto as T);
  return copia;
}
