import { createHmac } from "node:crypto";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import { telefonoNormalizado } from "./telefono";

/**
 * Fuera de producción, los datos de las clientas no entran a la base (`fase-1.4`,
 * decisión 2): QA y local leen la empresa real, pero acá se reemplazan antes de guardar.
 */

/** Ante la duda, se anonimiza: un ambiente sin nombre nunca recibe datos reales. */
export function hayQueAnonimizar(ambiente = process.env.APP_ENV): boolean {
  return ambiente !== "production";
}

/**
 * Siempre el mismo para el mismo número, así dos fichas de una clienta siguen
 * coincidiendo. Lleva la clave para que no se pueda averiguar el número probando
 * todos. Ninguna característica de Argentina empieza con 0: no puede sonarle a nadie.
 */
function telefonoFalso(normalizado: string, clave: string): string {
  const huella = createHmac("sha256", Buffer.from(clave, "base64url")).update(`clienta:telefono:${normalizado}`);
  return `00${String(huella.digest().readUInt32BE(0) % 100_000_000).padStart(8, "0")}`;
}

/**
 * Campo por campo y sin copiar el resto: un dato nuevo de la clienta no compila hasta
 * que alguien decida qué pasa con él. La provincia queda porque sirve para probar y
 * sola no identifica a nadie; la localidad, en un pueblo chico, podría.
 */
export function anonimizarClienta(clienta: ErpClienta, clave: string): ErpClienta {
  const normalizado = telefonoNormalizado(clienta.telefono);
  return {
    id: clienta.id,
    nombre: `Clienta ${clienta.id}`,
    telefono: normalizado && telefonoFalso(normalizado, clave),
    email: clienta.email && `clienta-${clienta.id}@anonimizada.invalid`,
    provincia: clienta.provincia,
    localidad: null,
    habilitada: clienta.habilitada,
    creadaEl: clienta.creadaEl,
  };
}
