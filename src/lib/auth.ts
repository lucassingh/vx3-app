/**
 * Usuario de la sesión. Por ahora hay un solo usuario (Elías, rol admin) con
 * credenciales fijas en src/lib/session.ts; la sesión es una cookie firmada
 * que valida src/proxy.ts. Cuando entre la auth real (usuarios y roles en la
 * base, `06` §4), se reemplaza esto y los componentes siguen igual.
 */

export type User = {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
};

export const currentUser: User = {
  name: "Elías Llaury",
  email: "eliasllaury@gmail.com",
  role: "Socio · Administrador",
};
