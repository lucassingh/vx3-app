import "server-only";
import { getDb } from "@/db/client";
import { isRole, type Role } from "../permissions";

/**
 * Usuarios de la app, para la pantalla Configuración → Usuarios y roles. Los
 * cambios (crear, rol, desactivar…) están en actions.ts.
 */

export type EstadoUsuario = "activo" | "pendiente" | "desactivado";

export type UsuarioFila = {
  id: string;
  nombre: string;
  email: string;
  usuario: string | null;
  rol: Role;
  puesto: string | null;
  /** ISO; null si nunca entró. */
  ultimoAcceso: string | null;
  /** pendiente: todavía no cambió la contraseña temporal. */
  estado: EstadoUsuario;
};

export async function listarUsuarios(): Promise<UsuarioFila[]> {
  const usuarios = await getDb().user.findMany({ orderBy: [{ banned: "asc" }, { name: "asc" }] });
  return usuarios.map((usuario) => ({
    id: usuario.id,
    nombre: usuario.name,
    email: usuario.email,
    usuario: usuario.displayUsername ?? usuario.username,
    rol: isRole(usuario.role) ? usuario.role : "solo_lectura",
    puesto: usuario.jobTitle,
    ultimoAcceso: usuario.lastLoginAt?.toISOString() ?? null,
    estado: usuario.banned ? "desactivado" : usuario.mustChangePassword ? "pendiente" : "activo",
  }));
}
