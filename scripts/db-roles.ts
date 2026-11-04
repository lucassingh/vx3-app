/**
 * npm run db:roles -- --branch develop|main [--rotar app|readonly]
 *
 * Crea los usuarios `app` y `readonly` en una branch de Neon y les vuelve a
 * aplicar los permisos (src/db/roles.ts). Se puede correr las veces que haga
 * falta: no cambia contraseñas salvo con --rotar.
 *
 * Las conexiones no se muestran: quedan en .secrets/neon-<branch>.env (fuera
 * de git), y de ahí van a Vercel, a los secrets del repo y a 1Password.
 *   DATABASE_URL            app, con pooler: la app en Vercel
 *   DATABASE_URL_UNPOOLED   el dueño, directa: las migraciones
 *   DATABASE_URL_READONLY   readonly, directa: soporte y backups
 *
 * Necesita NEON_API_KEY y NEON_PROJECT_ID (.env.local).
 */

import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { aplicarUsuarios, USUARIOS, type UsuarioDeBase, usuarioExiste } from "../src/db/roles";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

const { NEON_API_KEY, NEON_PROJECT_ID } = process.env;

async function neonApi<T>(ruta: string): Promise<T> {
  const response = await fetch(`https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}${ruta}`, {
    headers: { Authorization: `Bearer ${NEON_API_KEY}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Neon GET ${ruta} respondió ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

function conUsuario(uri: string, usuario: string, password: string) {
  const url = new URL(uri);
  url.username = usuario;
  url.password = password;
  return url.toString();
}

function leerArchivo(archivo: string): Record<string, string> {
  if (!fs.existsSync(archivo)) return {};
  const renglones = fs
    .readFileSync(archivo, "utf8")
    .split("\n")
    .filter((renglon) => renglon.includes("=") && !renglon.startsWith("#"));
  return Object.fromEntries(
    renglones.map((renglon) => [renglon.slice(0, renglon.indexOf("=")), renglon.slice(renglon.indexOf("=") + 1)]),
  );
}

async function main() {
  const { values } = parseArgs({
    options: { branch: { type: "string" }, rotar: { type: "string", multiple: true, default: [] } },
  });
  if (!NEON_API_KEY || !NEON_PROJECT_ID) throw new Error("Faltan NEON_API_KEY o NEON_PROJECT_ID en .env.local.");
  if (!values.branch) throw new Error("Falta la branch: npm run db:roles -- --branch develop");
  const rotar = values.rotar ?? [];
  for (const usuario of rotar) {
    if (!USUARIOS.includes(usuario as UsuarioDeBase)) throw new Error(`--rotar acepta ${USUARIOS.join(" o ")}.`);
  }

  const { branches } = await neonApi<{ branches: { id: string; name: string }[] }>("/branches");
  const branch = branches.find((candidata) => candidata.name === values.branch);
  if (!branch) throw new Error(`No existe la branch "${values.branch}" en el proyecto de Neon.`);

  const { databases } = await neonApi<{ databases: { name: string; owner_name: string }[] }>(
    `/branches/${branch.id}/databases`,
  );
  const database = databases[0];
  if (!database) throw new Error(`La branch ${branch.name} no tiene bases.`);

  const conexionDelDueño = async (pooled: boolean) => {
    const query = new URLSearchParams({
      branch_id: branch.id,
      database_name: database.name,
      role_name: database.owner_name,
      pooled: String(pooled),
    });
    const { uri } = await neonApi<{ uri: string }>(`/connection_uri?${query}`);
    return uri;
  };
  const directa = await conexionDelDueño(false);
  const conPooler = await conexionDelDueño(true);

  const sql = neon(directa);
  const consulta = (texto: string) => sql.query(texto) as Promise<Record<string, unknown>[]>;

  const passwords: Partial<Record<UsuarioDeBase, string>> = {};
  for (const usuario of USUARIOS) {
    if (rotar.includes(usuario) || !(await usuarioExiste(consulta, usuario))) {
      passwords[usuario] = randomBytes(24).toString("base64url");
    }
  }
  await aplicarUsuarios(consulta, { dueño: database.owner_name, passwords });

  // Se suman a lo que ya hubiera: sin --rotar, la contraseña de un usuario existente no se conoce.
  const archivo = path.join(".secrets", `neon-${branch.name}.env`);
  const conexiones: Record<string, string> = { ...leerArchivo(archivo), DATABASE_URL_UNPOOLED: directa };
  if (passwords.app) conexiones.DATABASE_URL = conUsuario(conPooler, "app", passwords.app);
  if (passwords.readonly) conexiones.DATABASE_URL_READONLY = conUsuario(directa, "readonly", passwords.readonly);

  fs.mkdirSync(".secrets", { recursive: true });
  fs.writeFileSync(
    archivo,
    [
      `# Branch ${branch.name} de Neon. npm run db:roles, ${new Date().toISOString()}. No va a git.`,
      ...Object.entries(conexiones).map(([clave, valor]) => `${clave}=${valor}`),
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  for (const usuario of USUARIOS) {
    console.log(`  ${usuario}: ${passwords[usuario] ? "contraseña nueva" : "ya existía, misma contraseña"}`);
  }
  console.log(`Permisos aplicados en ${branch.name}. Conexiones en ${archivo}.`);
  const faltan = ["DATABASE_URL", "DATABASE_URL_READONLY"].filter((clave) => !conexiones[clave]);
  if (faltan.length) {
    console.log(`Sin ${faltan.join(" ni ")} en el archivo: para generarlas, --rotar app o --rotar readonly.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
