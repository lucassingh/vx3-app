import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de las credenciales de las integraciones (RF-M0-06): AES-256-GCM, con
 * la clave maestra fuera de la base. Si alguien altera lo guardado, o lo copia a
 * otra integración, descifrar falla: el nombre de la integración entra como dato
 * autenticado.
 *
 * Formato guardado: v1.<iv>.<tag>.<cifrado>, en base64url. La versión permite
 * cambiar el formato sin tener que adivinar con qué se cifró cada fila.
 */

const ALGORITMO = "aes-256-gcm";
const VERSION = "v1";
const BYTES_IV = 12;

export function cifrar(texto: string, clave: Buffer, integracion: string): string {
  const iv = randomBytes(BYTES_IV);
  const cipher = createCipheriv(ALGORITMO, clave, iv);
  cipher.setAAD(Buffer.from(integracion));
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const partes = [iv, cipher.getAuthTag(), cifrado].map((parte) => parte.toString("base64url"));
  return [VERSION, ...partes].join(".");
}

/** Tira un error si la clave no es la misma, si lo guardado cambió o si es de otra integración. */
export function descifrar(guardado: string, clave: Buffer, integracion: string): string {
  const [version, iv, tag, cifrado] = guardado.split(".");
  if (version !== VERSION || !iv || !tag || cifrado === undefined) {
    throw new Error("Formato de credencial desconocido");
  }
  const decipher = createDecipheriv(ALGORITMO, clave, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(integracion));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, "base64url")), decipher.final()]).toString("utf8");
}

/** Lo único que se muestra de una credencial: los últimos 4 caracteres. */
export function enmascarar(valor: string): string {
  return `••••${valor.slice(-4)}`;
}
