/**
 * node scripts/restore-test.mjs <dump.sql>
 *
 * Prueba que un backup se puede restaurar (infraestructura.md §9). Lo corre
 * restore-test.yml con la última copia ya descifrada:
 *
 *   1. Crea una branch efímera desde develop (nunca desde main, §4.3) y adentro
 *      una base vacía, `restaurada`.
 *   2. Restaura el dump con psql y corta en el primer error.
 *   3. Cuenta las filas de cada tabla y las deja en el resumen del job.
 *   4. Borra la branch, salga como salga. Si el proceso muere, Neon la borra
 *      sola a las 2 horas.
 *
 * Necesita NEON_API_KEY, NEON_PROJECT_ID y psql 18 en el PATH.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { connectionUrls, createEphemeralBranch, deleteBranch, neon, neonEnv, waitForOperations } from "./neon-api.mjs";

const [dump] = process.argv.slice(2);
if (!dump || !fs.existsSync(dump)) {
  console.error("Uso: node scripts/restore-test.mjs <dump.sql>");
  process.exit(1);
}
neonEnv();

const DATABASE = "restaurada";
// Filas exactas de cada tabla de public, en una sola consulta.
const CONTEO = `
  SELECT table_name,
    (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name`;

function psql(url, args) {
  const result = spawnSync("psql", ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", ...args, url], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error) throw new Error(`No se pudo correr psql: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`psql terminó con ${result.status}.`);
  return result.stdout;
}

const startedAt = Date.now();
const created = await createEphemeralBranch(
  `restore/test-${process.env.GITHUB_RUN_ID ?? "local"}-${Date.now()}`,
  "develop",
);

let exitCode = 1;
try {
  await waitForOperations(created.operations ?? []);
  const { role } = await connectionUrls(created);
  const { operations } = await neon("POST", `/branches/${created.branch.id}/databases`, {
    database: { name: DATABASE, owner_name: role },
  });
  await waitForOperations(operations ?? []);
  const { direct } = await connectionUrls(created, DATABASE);

  console.log(`\n→ Restaurando ${dump} (${(fs.statSync(dump).size / 1024 / 1024).toFixed(1)} MB)`);
  psql(direct, ["--quiet", "--file", dump]);

  console.log("→ Contando filas");
  const tablas = psql(direct, ["--tuples-only", "--no-align", "--field-separator", "\t", "--command", CONTEO])
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((renglon) => renglon.split("\t"));
  if (tablas.length === 0) throw new Error("La restauración no dejó ninguna tabla.");

  const filas = tablas.map(([tabla, cantidad]) => `| ${tabla} | ${cantidad} |`);
  console.log(tablas.map(([tabla, cantidad]) => `  ${tabla}: ${cantidad}`).join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      ["### Restauración completa", "", "| Tabla | Filas |", "| --- | ---: |", ...filas, ""].join("\n"),
    );
  }
  exitCode = 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await deleteBranch(created, startedAt);
}

process.exit(exitCode);
