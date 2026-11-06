/**
 * npm run test:int: los tests de integración (*.int.test.ts) contra una base
 * real que se crea y se destruye en cada corrida.
 *
 *   1. Crea una branch efímera de Neon a partir de develop (copia instantánea,
 *      con los datos y el esquema de develop).
 *   2. Aplica las migraciones pendientes (prisma migrate deploy) y verifica que
 *      la base quede igual a schema.prisma (prisma migrate diff): si alguien
 *      cambió el esquema sin crear la migración, falla acá.
 *   3. Corre el proyecto "integration" de Vitest apuntando a esa branch.
 *   4. Borra la branch, aunque los tests fallen o se cancele la corrida. Si el
 *      proceso muere antes, Neon la borra sola a las 2 horas (expires_at).
 *
 * Necesita NEON_API_KEY y NEON_PROJECT_ID (.env.local o los secrets de la CI).
 * NEON_PARENT_BRANCH cambia la branch de origen (por defecto, develop).
 */

import { spawnSync } from "node:child_process";
import { connectionUrls, createEphemeralBranch, deleteBranch, neonEnv, waitForOperations } from "./neon-api.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // En la CI no hay .env.local: las variables vienen del entorno.
}

neonEnv();
const { NEON_PARENT_BRANCH = "develop" } = process.env;

// Al cancelar, la CI y Ctrl+C le mandan la señal a todo el grupo: sin esto, este proceso se corta
// junto con los tests y no llega a borrar la branch. Se sigue de largo hasta el finally.
let cancelada = false;
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    cancelada = true;
  });
}

function run(label, args, env) {
  if (cancelada) return 1;
  console.log(`\n→ ${label}`);
  const { status } = spawnSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });
  return status ?? 1;
}

const startedAt = Date.now();
let created;
try {
  created = await createEphemeralBranch(
    `test/int-${process.env.GITHUB_RUN_ID ?? "local"}-${Date.now()}`,
    NEON_PARENT_BRANCH,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

let exitCode = 1;
try {
  await waitForOperations(created.operations ?? []);
  const urls = await connectionUrls(created);
  const env = { DATABASE_URL: urls.pooled, DATABASE_URL_UNPOOLED: urls.direct };

  exitCode = run(
    "Migraciones (prisma migrate deploy)",
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    env,
  );
  if (exitCode === 0) {
    // Con las migraciones aplicadas, la base tiene que quedar igual a schema.prisma.
    exitCode = run(
      "Esquema y migraciones en sincronía (prisma migrate diff)",
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      env,
    );
    if (exitCode === 2) {
      console.error(
        "\nschema.prisma tiene cambios que ninguna migración aplica. Creala con: npm run db:migrate:dev -- --name <cambio>",
      );
    }
  }
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
  await deleteBranch(created, startedAt);
  // Queda a la vista en la corrida: sirve para ver cuánto margen hay contra el tope.
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice title=Integración::${Math.round((Date.now() - startedAt) / 60_000)} min`);
  }
}

process.exit(exitCode);
