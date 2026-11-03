/**
 * Permisos finos (tecnica_doc §6.3). Se agregan a medida que entra cada
 * acción. La matriz rol × permiso llega en el ítem 1.2.3; hasta entonces solo
 * el admin los tiene.
 */

export const PERMISSIONS = [
  /** Usar y probar las credenciales de las integraciones (DUX, Meta…). */
  "settings.credentials",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function hasPermission(user: { role: string }, permission: Permission) {
  return user.role === "admin" && PERMISSIONS.includes(permission);
}
