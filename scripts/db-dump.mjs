// Copia de la base de desarrollo a un archivo local, con pg_dump.
// Uso: npm run db:dump   →   backups/<branch>-AAAA-MM-DD-HHMM.sql
// Los backups de producción no salen de acá: los hace la CI, cifrados (infraestructura.md §9).
import { spawnSync } from "node:child_process";
import fs from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usan las variables del entorno.
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("Falta DATABASE_URL_UNPOOLED (la conexión directa de Neon): ver .env.example.");
  process.exit(1);
}

const version = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
if (version.error) {
  console.error(
    "No encontré pg_dump. Instalá las herramientas de cliente de PostgreSQL (versión 18) y que pg_dump quede en el PATH.",
  );
  process.exit(1);
}

const host = new URL(url).hostname.split(".")[0];
const fecha = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
fs.mkdirSync("backups", { recursive: true });
const destino = `backups/${host}-${fecha}.sql`;

const dump = spawnSync("pg_dump", ["--no-owner", "--no-privileges", "--file", destino, url], { stdio: "inherit" });
if (dump.status !== 0) process.exit(dump.status ?? 1);
console.log(`Listo: ${destino}`);
