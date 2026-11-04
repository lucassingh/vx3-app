/**
 * Usuarios de la base (infraestructura.md §6). Migra el dueño del esquema
 * (`neondb_owner`, el que crea Neon con la branch). La app usa `app`, que lee y
 * escribe datos pero no toca el esquema, y soporte y los backups usan
 * `readonly`.
 *
 * `app` y `readonly` se crean por SQL y no desde la consola de Neon: los de la
 * consola entran a `neon_superuser`, que puede crear roles y bases.
 *
 * Es idempotente: los permisos se vuelven a aplicar en cada corrida, y los de
 * las tablas que creen las migraciones después los da ALTER DEFAULT PRIVILEGES.
 */

export const USUARIOS = ["app", "readonly"] as const;
export type UsuarioDeBase = (typeof USUARIOS)[number];

/** Ejecuta una sentencia y devuelve las filas (el driver de Neon, o uno de prueba). */
export type Consulta = (texto: string) => Promise<Record<string, unknown>[]>;

/** Sin comillas ni signos raros: va literal en el CREATE ROLE, que no acepta parámetros. */
const PASSWORD_VALIDA = /^[A-Za-z0-9_-]{24,}$/;

function identificador(nombre: string) {
  return `"${nombre.replaceAll('"', '""')}"`;
}

/** La sentencia corre solo si la tabla existe (en una branch sin migrar todavía no está). */
function siExisteLaTabla(tabla: string, sentencia: string) {
  return `DO $$ BEGIN IF to_regclass('public.${tabla}') IS NOT NULL THEN ${sentencia}; END IF; END $$`;
}

/** Crea el usuario con esa contraseña, o se la cambia si ya existe. */
export function sentenciaDeUsuario(usuario: UsuarioDeBase, password: string) {
  if (!PASSWORD_VALIDA.test(password)) {
    throw new Error("La contraseña tiene que tener al menos 24 caracteres entre letras, números, - y _.");
  }
  const rol = identificador(usuario);
  return [
    "DO $$ BEGIN",
    `IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${usuario}') THEN ALTER ROLE ${rol} WITH LOGIN PASSWORD '${password}';`,
    `ELSE CREATE ROLE ${rol} WITH LOGIN PASSWORD '${password}';`,
    "END IF; END $$",
  ].join(" ");
}

/** Los permisos de `app` y `readonly`, para las tablas de hoy y las que cree `dueño` después. */
export function sentenciasDePermisos(dueño: string) {
  const owner = identificador(dueño);
  const futuras = `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT`;
  return [
    // Solo el dueño crea objetos en public (Postgres 15 ya lo trae así; queda explícito).
    "REVOKE CREATE ON SCHEMA public FROM PUBLIC",
    "GRANT USAGE ON SCHEMA public TO app, readonly",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app",
    "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app",
    "GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly",
    "GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly",
    `${futuras} SELECT, INSERT, UPDATE, DELETE ON TABLES TO app`,
    `${futuras} USAGE, SELECT ON SEQUENCES TO app`,
    `${futuras} SELECT ON TABLES TO readonly`,
    `${futuras} SELECT ON SEQUENCES TO readonly`,
    // La auditoría solo se agrega, y el historial de migraciones es del dueño.
    siExisteLaTabla("audit_logs", "REVOKE UPDATE, DELETE ON TABLE audit_logs FROM app"),
    siExisteLaTabla("_prisma_migrations", "REVOKE INSERT, UPDATE, DELETE ON TABLE _prisma_migrations FROM app"),
  ];
}

export async function usuarioExiste(consulta: Consulta, usuario: UsuarioDeBase) {
  const filas = await consulta(`SELECT 1 FROM pg_roles WHERE rolname = '${usuario}'`);
  return filas.length > 0;
}

/**
 * Crea o cambia la contraseña de los usuarios que vengan en `passwords` y
 * después aplica los permisos. Corre como el dueño del esquema.
 */
export async function aplicarUsuarios(
  consulta: Consulta,
  { dueño, passwords = {} }: { dueño: string; passwords?: Partial<Record<UsuarioDeBase, string>> },
) {
  for (const usuario of USUARIOS) {
    const password = passwords[usuario];
    if (password) await consulta(sentenciaDeUsuario(usuario, password));
    else if (!(await usuarioExiste(consulta, usuario))) {
      throw new Error(`El usuario ${usuario} no existe y no vino su contraseña para crearlo.`);
    }
  }
  for (const sentencia of sentenciasDePermisos(dueño)) await consulta(sentencia);
}
