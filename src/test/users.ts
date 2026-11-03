import type { SessionUser } from "@/modules/platform/auth/session";
import type { Role } from "@/modules/platform/permissions";

/** Usuario de sesión para tests, con el rol que haga falta. */
export function usuarioDePrueba(role: Role = "admin", datos: Partial<SessionUser> = {}): SessionUser {
  return {
    id: `usuario-${role}`,
    name: "Elías Llaury",
    email: `${role}@vx3.test`,
    username: null,
    role,
    jobTitle: null,
    mustChangePassword: false,
    ...datos,
  };
}
