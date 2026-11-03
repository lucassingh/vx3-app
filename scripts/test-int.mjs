/**
 * npm run test:int: los tests de integración (*.int.test.ts) contra una base
 * real que se crea y se destruye en cada corrida.
 *
 *   1. Crea una branch efímera de Neon a partir de develop (copia instantánea,
 *      con los datos y el esquema de develop).
 *   2. Aplica las migraciones pendientes (prisma migrate deploy).
 *   3. Corre el proyecto "integration" de Vitest apuntando a esa branch.
 *   4. Borra la branch, aunque los tests fallen. Si el proceso muere antes,
 *      Neon la borra sola a las 2 horas (expires_at).
 *
 * Necesita NEON_API_KEY y NEON_PROJECT_ID (.env.local o los secrets de la CI).
 * NEON_PARENT_BRANCH cambia la branch de origen (por defecto, develop).
 */

import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // En la CI no hay .env.local: las variables vienen del entorno.
}

const { NEON_API_KEY, NEON_PROJECT_ID, NEON_PARENT_BRANCH = "develop" } = process.env;
const NEON_API = "https://console.neon.tech/api/v2";
const TTL_MS = 2 * 60 * 60 * 1000;

if (!NEON_API_KEY || !NEON_PROJECT_ID) {
  console.error(
    "Faltan NEON_API_KEY o NEON_PROJECT_ID. En local van en .env.local (.env.example dice de dónde salen); en la CI, en los secrets del repo.",
  );
  process.exit(1);
}

async function neon(method, path, body) {
  const response = await fetch(`${NEON_API}/projects/${NEON_PROJECT_ID}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NEON_API_KEY}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Neon ${method} ${path} respondió ${response.status}: ${await response.text()}`);
  return response.json();
}

async function waitForOperations(operations) {
  const deadline = Date.now() + 120_000;
  for (const { id } of operations) {
    for (;;) {
      const { operation } = await neon("GET", `/operations/${id}`);
      if (operation.status === "finished" || operation.status === "skipped") break;
      if (["failed", "error", "cancelled"].includes(operation.status)) {
        throw new Error(`La operación ${operation.action} de Neon terminó en ${operation.status}.`);
      }
      if (Date.now() > deadline) throw new Error("Neon tardó más de 2 minutos en preparar la branch.");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}

function run(label, args, env) {
  console.log(`\n→ ${label}`);
  const { status } = spawnSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });
  return status ?? 1;
}

const startedAt = Date.now();
const { branches } = await neon("GET", "/branches");
const parent = branches.find((branch) => branch.name === NEON_PARENT_BRANCH);
if (!parent) {
  console.error(`No existe la branch "${NEON_PARENT_BRANCH}" en el proyecto de Neon.`);
  process.exit(1);
}

const name = `test/int-${process.env.GITHUB_RUN_ID ?? "local"}-${Date.now()}`;
console.log(`→ Creando la branch efímera ${name} desde ${parent.name}`);
const created = await neon("POST", "/branches", {
  branch: { name, parent_id: parent.id, expires_at: new Date(Date.now() + TTL_MS).toISOString() },
  endpoints: [{ type: "read_write" }],
});

let exitCode = 1;
try {
  await waitForOperations(created.operations ?? []);
  const connection = created.connection_uris?.[0]?.connection_parameters;
  if (!connection?.pooler_host) throw new Error("Neon no devolvió los datos de conexión de la branch nueva.");

  const credentials = `${encodeURIComponent(connection.role)}:${encodeURIComponent(connection.password)}`;
  const url = (host) => `postgresql://${credentials}@${host}/${connection.database}?sslmode=require`;
  const env = {
    DATABASE_URL: url(connection.pooler_host),
    DATABASE_URL_UNPOOLED: url(connection.host),
  };

  exitCode = run(
    "Migraciones (prisma migrate deploy)",
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    env,
  );
  if (exitCode === 0) {
    exitCode = run(
      "Tests de integración",
      ["node_modules/vitest/vitest.mjs", "run", "--project", "integration", ...process.argv.slice(2)],
      env,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  try {
    await neon("DELETE", `/branches/${created.branch.id}`);
    console.log(`\n→ Branch ${name} borrada (${Math.round((Date.now() - startedAt) / 1000)} s en total)`);
  } catch (error) {
    console.error(`No se pudo borrar la branch ${name}; Neon la borra sola a las 2 horas.`, error);
  }
}

process.exit(exitCode);
