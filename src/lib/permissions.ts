/**
 * Permisos finos (tecnica_doc §6.3). Se agregan a medida que entra cada
 * acción. La matriz rol × permiso llega con la auth real (fase 1.2); hasta
 * entonces hay un solo usuario, admin, que tiene todos.
 */

export const PERMISSIONS = [
  /** Usar y probar las credenciales de las integraciones (DUX, Meta…). */
  "settings.credentials",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = "admin";

export type SessionUser = { email: string; role: Role };

export function hasPermission(user: SessionUser, permission: Permission) {
  return user.role === "admin" && PERMISSIONS.includes(permission);
}
