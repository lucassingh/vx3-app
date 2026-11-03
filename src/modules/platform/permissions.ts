/**
 * Roles de la app (solucion_doc/06 §4). Los nombres quedan en castellano, como
 * en el contrato de la maqueta (`RolUsuario`).
 */

export const ROLES = ["admin", "operaciones", "postventa", "compras", "marketing", "solo_lectura"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
