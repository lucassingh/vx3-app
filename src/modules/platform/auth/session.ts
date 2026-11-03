import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { puedeVerPagina } from "../access";
import { can, isRole, type Permission, type Role } from "../permissions";
import { getAuth } from "./auth";

/** Lo que la app sabe del usuario de la sesión. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  jobTitle: string | null;
  mustChangePassword: boolean;
};

/**
 * Usuario de la sesión, validado contra la base (no alcanza con que haya
 * cookie: la sesión puede estar vencida, cerrada o el usuario desactivado).
 * Se resuelve una vez por request aunque lo pidan varios componentes.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || session.user.banned) return null;

  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.displayUsername ?? user.username ?? null,
    // Un rol que ya no existe no da permisos de más: queda como solo lectura.
    role: isRole(user.role) ? user.role : "solo_lectura",
    jobTitle: user.jobTitle ?? null,
    mustChangePassword: user.mustChangePassword ?? false,
  };
});

/**
 * Para pantallas: el usuario de la sesión o, si no hay, al login. Con una
 * contraseña temporal, primero a cambiarla.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/cambiar-contrasena");
  return user;
}

/**
 * Primera línea de cada pantalla del dashboard: sin sesión, al login; si el rol
 * no puede ver el área de esa ruta (access.ts), a "Sin permiso". Un test
 * verifica que ninguna pantalla se la olvide.
 */
export async function requirePageAccess(href: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!puedeVerPagina(user.role, href)) redirect("/sin-permiso");
  return user;
}

/** Para Server Actions y servicios: el usuario, si tiene el permiso; si no, un error de dominio. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthenticatedError();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}
