import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { serverEnv } from "@/env";
import { type Role, ROLES } from "../permissions";

/**
 * Better Auth (tecnica_doc/tecnica.md §6, T-Q01): usuarios, contraseñas y
 * sesiones en nuestra Postgres.
 *
 * No hay ruta HTTP de Better Auth (/api/auth/*): todo pasa por Server Actions
 * que llaman a `getAuth().api.*`, así lo único expuesto son nuestras acciones,
 * con su validación, su límite de intentos y su auditoría. El plugin
 * nextCookies escribe la cookie de sesión desde esas acciones.
 */

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const ONE_DAY_S = 24 * 60 * 60;

/** Solo para desarrollo y tests: en producción AUTH_SECRET es obligatoria (src/env.ts). */
const DEV_SECRET = "vx3-desarrollo-local-nunca-en-produccion";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Los roles de la app para el plugin admin: solo `admin` puede administrar
 * usuarios. Los permisos de cada área no viven acá sino en permissions.ts; esto
 * además hace que Better Auth rechace un rol que no existe.
 */
const accessControl = createAccessControl(defaultStatements);
const sinAdministracion = accessControl.newRole({});
const authRoles = Object.fromEntries(
  ROLES.map((role) => [role, role === "admin" ? adminAc : sinAdministracion]),
) as Record<Role, typeof sinAdministracion>;

/**
 * Producción fija BETTER_AUTH_URL. En QA y en las previews la URL cambia en
 * cada deploy y se toma la que pone Vercel; alcanza porque sin ruta HTTP
 * Better Auth no compara orígenes, y con https la cookie sale `Secure`.
 */
function baseURL(env: ReturnType<typeof serverEnv>) {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  return env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000";
}

function createAuth() {
  const env = serverEnv();
  return betterAuth({
    appName: "VX3",
    baseURL: baseURL(env),
    secret: env.AUTH_SECRET ?? DEV_SECRET,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    advanced: {
      cookiePrefix: "vx3",
      // uuid v7 como el resto de las tablas (src/db/ids.ts).
      database: { generateId: () => newId() },
    },
    telemetry: { enabled: false },
    // El límite de Better Auth es por request HTTP y acá no hay; el nuestro está en throttle.ts.
    rateLimit: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    },
    session: {
      expiresIn: SEVEN_DAYS_S,
      // Con uso, el vencimiento se corre 7 días como mucho una vez por día.
      updateAge: ONE_DAY_S,
    },
    user: {
      additionalFields: {
        mustChangePassword: { type: "boolean", defaultValue: false, input: false },
        jobTitle: { type: "string", required: false, input: false },
        lastLoginAt: { type: "date", required: false, input: false },
      },
    },
    plugins: [
      username(),
      admin({
        ac: accessControl,
        roles: authRoles,
        defaultRole: "solo_lectura",
        adminRoles: ["admin"],
        bannedUserMessage: "Tu usuario está desactivado. Si es un error, hablá con un administrador.",
      }),
      // Tiene que ir último.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** La instancia se crea la primera vez que se usa: así el build no necesita la base. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
