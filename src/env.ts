import { z } from "zod";
import { API_DOMAINS } from "@/lib/api/domains";

/**
 * Variables de entorno validadas con Zod. `.env.example` dice de dónde sale
 * cada una.
 *
 * Se validan en cada lectura (no se cachean), así los tests las pueden cambiar
 * con `vi.stubEnv`. Además la app las valida una vez al arrancar
 * (`src/instrumentation.ts`): si algo falta o está mal, el error aparece ahí y
 * no en medio de un request.
 *
 * Qué es obligatorio depende del modo:
 * - **desarrollo:** las conexiones a Neon.
 * - **producción** (al arrancar el servidor): la conexión con pooler y
 *   `AUTH_SECRET`. La directa no: es del dueño del esquema y solo migra.
 * - **test, build o `SKIP_ENV_VALIDATION=1`:** nada obligatorio; solo se valida
 *   el formato de lo que esté cargado. `next build` corre con NODE_ENV=production
 *   y en la CI no tiene secretos.
 */

type Fuente = Record<string, string | undefined>;
type Modo = "desarrollo" | "produccion" | "relajado";

function modoDe(fuente: Fuente): Modo {
  if (fuente.SKIP_ENV_VALIDATION || fuente.NODE_ENV === "test") return "relajado";
  if (fuente.NEXT_PHASE === "phase-production-build") return "relajado";
  return fuente.NODE_ENV === "production" ? "produccion" : "desarrollo";
}

/** En un .env, `CLAVE=` llega como cadena vacía: cuenta como no cargada. */
function opcional<T extends z.ZodType>(esquema: T) {
  return z.preprocess((valor) => (valor === "" ? undefined : valor), esquema.optional());
}

const ENTERO_POSITIVO = "tiene que ser un número entero positivo";
const enteroPositivo = z.coerce.number({ error: ENTERO_POSITIVO }).int(ENTERO_POSITIVO).positive(ENTERO_POSITIVO);

function conexionNeon(conPooler: boolean) {
  return z
    .string()
    .regex(/^postgres(ql)?:\/\//, "tiene que ser una conexión de Postgres (empieza con postgresql://)")
    .refine(
      (url) => /@[^/]*-pooler\./.test(url) === conPooler,
      conPooler
        ? "tiene que ser la conexión con pooler (el host lleva -pooler): Neon → Connect → Connection pooling prendido"
        : "tiene que ser la conexión directa (el host sin -pooler): Neon → Connect → Connection pooling apagado",
    );
}

const esquemaServidor = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: opcional(
    z
      .string()
      .min(
        32,
        "tiene que tener al menos 32 caracteres. Generá una con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
      ),
  ),
  /** URL pública de la app, para Better Auth. En local, http://localhost:3000. */
  BETTER_AUTH_URL: opcional(z.url("tiene que ser una URL, como http://localhost:3000")),
  /** La pone Vercel en cada deploy: el host del deploy, sin https://. */
  VERCEL_URL: opcional(z.string()),
  /** Vercel Cron lo manda en cada llamada a /api/cron/*. Sin él, esas rutas responden 401. */
  CRON_SECRET: opcional(z.string().min(32, "tiene que tener al menos 32 caracteres")),
  DATABASE_URL: opcional(conexionNeon(true)),
  DATABASE_URL_UNPOOLED: opcional(conexionNeon(false)),
  NEON_API_KEY: opcional(z.string()),
  NEON_PROJECT_ID: opcional(z.string()),
  /** Dominios que usan su implementación real, separados por coma. Los demás usan la API simulada. */
  API_REAL_DOMAINS: z.preprocess(
    (valor) =>
      typeof valor === "string"
        ? valor
            .split(",")
            .map((dominio) => dominio.trim())
            .filter(Boolean)
        : [],
    z.array(z.enum(API_DOMAINS, `dominio desconocido. Los válidos: ${API_DOMAINS.join(", ")}`)),
  ),
  MOCK_API_DELAY_MS: opcional(
    z.coerce.number({ error: "tiene que ser un número de milisegundos" }).int().min(0, "no puede ser negativa"),
  ).default(350),
  MOCK_API_FAILURE_RATE: opcional(
    z.coerce
      .number({ error: "es una probabilidad: va de 0 a 1" })
      .min(0, "es una probabilidad: va de 0 a 1")
      .max(1, "es una probabilidad: va de 0 a 1"),
  ).default(0),
  /** Vacía: debug en desarrollo, info en producción y nada en los tests. */
  LOG_LEVEL: opcional(
    z.enum(
      ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      "fatal, error, warn, info, debug, trace o silent",
    ),
  ),
  /** Clave maestra de las credenciales de las integraciones. Sin ella no se guardan ni se leen. */
  CREDENTIALS_KEY: opcional(
    z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{43}$/,
        "tienen que ser 32 bytes en base64url. Generá una con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
      ),
  ),
  DUX_API_URL: opcional(z.url("tiene que ser una URL")),
  DUX_TOKEN: opcional(z.string()),
  DUX_ID_EMPRESA: opcional(enteroPositivo),
  DUX_ID_SUCURSAL_ECOMMERCE: opcional(enteroPositivo),
  DUX_ID_SUCURSAL_LOCAL: opcional(enteroPositivo),
  DUX_ID_DEPOSITO: opcional(enteroPositivo),
});

const OBLIGATORIAS: Record<Modo, (keyof z.infer<typeof esquemaServidor>)[]> = {
  desarrollo: ["DATABASE_URL", "DATABASE_URL_UNPOOLED"],
  // La conexión directa es del dueño del esquema y solo la usan las migraciones: no va en Vercel.
  produccion: ["DATABASE_URL", "AUTH_SECRET"],
  relajado: [],
};

function errorDeEnv(issues: z.core.$ZodIssue[]) {
  const renglones = issues.map((issue) => `  - ${issue.path.join(".") || "(general)"}: ${issue.message}`);
  return new Error(
    [
      "Hay variables de entorno con problemas:",
      ...renglones,
      "Revisá .env.local en local, o las variables del proyecto en Vercel. .env.example dice de dónde sale cada una.",
    ].join("\n"),
  );
}

/** Variables del servidor, validadas. Tira un error que dice cuáles faltan o están mal y qué hacer. */
export function serverEnv(fuente: Fuente = process.env) {
  const modo = modoDe(fuente);
  const resultado = esquemaServidor
    .superRefine((env, ctx) => {
      for (const clave of OBLIGATORIAS[modo]) {
        if (env[clave] === undefined) {
          ctx.addIssue({ code: "custom", path: [clave], message: `falta, y es obligatoria en ${modo}` });
        }
      }
    })
    .safeParse(fuente);
  if (!resultado.success) throw errorDeEnv(resultado.error.issues);
  return resultado.data;
}

/** Valida todo de una vez. Se llama al arrancar el servidor. */
export function validateEnv() {
  serverEnv();
}
