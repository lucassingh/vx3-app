"use client";

import { createContext, use } from "react";
import type { Role } from "@/modules/platform/permissions";

/**
 * Usuario de la sesión para los componentes cliente. Lo lee el layout del
 * dashboard en el servidor (src/modules/platform/auth/session.ts) y lo pasa
 * por contexto: los componentes usan `useCurrentUser()`.
 *
 * Es para mostrar (nombre, rol, menú). Lo que protege los datos es la
 * verificación del servidor en cada página, ruta y acción.
 */

export type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  /** "Administración", "Post-venta"… */
  roleLabel: string;
  jobTitle: string | null;
  avatarUrl?: string;
};

const CurrentUserContext = createContext<User | null>(null);

export function CurrentUserProvider({ user, children }: { user: User; children: React.ReactNode }) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

export function useCurrentUser(): User {
  const user = use(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser se usa dentro de CurrentUserProvider (layout del dashboard).");
  return user;
}
