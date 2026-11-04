/**
 * node scripts/smoke.mjs <url> [--commit <sha>]
 *
 * Prueba rápida después de cada deploy: /api/health?base=1 tiene que responder
 * 200 con la base OK y, si se pasa --commit, con ese commit (así se sabe que
 * el dominio ya apunta al deploy nuevo). Reintenta durante 2 minutos, lo que
 * tarda en despertar la base de Neon y en moverse un alias.
 *
 * Las previews y QA están detrás de la protección de Vercel: con VERCEL_TOKEN,
 * VERCEL_ORG_ID y VERCEL_PROJECT_ID en el entorno, pide el secreto de
 * "Protection Bypass for Automation" del proyecto y lo manda en el header.
 */

import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ options: { commit: { type: "string" } }, allowPositionals: true });
const [base] = positionals;
if (!base) {
  console.error("Uso: node scripts/smoke.mjs <url> [--commit <sha>]");
  process.exit(1);
}

const LIMITE_MS = 120_000;
const ESPERA_MS = 5_000;

async function secretoDeBypass() {
  const { VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID } = process.env;
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) return undefined;
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_ORG_ID ?? ""}`,
    {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    },
  );
  if (!response.ok) throw new Error(`Vercel respondió ${response.status} al pedir el proyecto.`);
  const { protectionBypass = {} } = await response.json();
  return Object.entries(protectionBypass).find(([, datos]) => datos?.scope === "automation-bypass")?.[0];
}

const url = new URL("/api/health?base=1", base.startsWith("http") ? base : `https://${base}`);
const bypass = await secretoDeBypass();
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};

const inicio = Date.now();
let ultimo = "sin respuesta";
while (Date.now() - inicio < LIMITE_MS) {
  try {
    const response = await fetch(url, { headers, redirect: "manual" });
    const cuerpo = response.headers.get("content-type")?.includes("json") ? await response.json() : undefined;
    if (response.ok && cuerpo?.ok && (!values.commit || cuerpo.commit === values.commit)) {
      console.log(`OK ${url.host}: versión ${cuerpo.version}, commit ${cuerpo.commit}, base en ${cuerpo.base?.ms} ms.`);
      process.exit(0);
    }
    ultimo = cuerpo
      ? `${response.status}: ${JSON.stringify(cuerpo)}`
      : `${response.status} sin JSON (¿la protección de Vercel?)`;
  } catch (error) {
    ultimo = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, ESPERA_MS));
}

console.error(`${url} no respondió bien en ${LIMITE_MS / 1000} s. Lo último: ${ultimo}`);
process.exit(1);
