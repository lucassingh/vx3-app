/**
 * La API de Neon para los scripts que crean branches efímeras (test-int.mjs,
 * restore-test.mjs). Necesita NEON_API_KEY y NEON_PROJECT_ID en el entorno.
 */

const NEON_API = "https://console.neon.tech/api/v2";

export function neonEnv() {
  const { NEON_API_KEY, NEON_PROJECT_ID } = process.env;
  if (!NEON_API_KEY || !NEON_PROJECT_ID) {
    console.error(
      "Faltan NEON_API_KEY o NEON_PROJECT_ID. En local van en .env.local (.env.example dice de dónde salen); en la CI, en los secrets del repo.",
    );
    process.exit(1);
  }
  return { NEON_API_KEY, NEON_PROJECT_ID };
}

export async function neon(method, path, body) {
  const { NEON_API_KEY, NEON_PROJECT_ID } = neonEnv();
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

export async function waitForOperations(operations) {
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

/**
 * Crea una branch que nace de `parentName` y que Neon borra sola a las 2 horas
 * si nadie la borra antes. Devuelve la respuesta de Neon (branch, bases, roles).
 */
export async function createEphemeralBranch(name, parentName) {
  const { branches } = await neon("GET", "/branches");
  const parent = branches.find((branch) => branch.name === parentName);
  if (!parent) throw new Error(`No existe la branch "${parentName}" en el proyecto de Neon.`);

  console.log(`→ Creando la branch efímera ${name} desde ${parent.name}`);
  const created = await neon("POST", "/branches", {
    branch: { name, parent_id: parent.id, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
    endpoints: [{ type: "read_write" }],
  });
  return created;
}

/**
 * Las conexiones del dueño de la branch recién creada, a `database` (por
 * defecto, la de la branch). Se piden aparte: con más de un usuario en la
 * branch (app y readonly, src/db/roles.ts), Neon no las manda al crearla.
 */
export async function connectionUrls(created, database) {
  const own = created.databases?.[0];
  if (!own) throw new Error("La branch nueva no tiene bases.");
  const uri = async (pooled) => {
    const query = new URLSearchParams({
      branch_id: created.branch.id,
      database_name: own.name,
      role_name: own.owner_name,
      pooled: String(pooled),
    });
    const url = new URL((await neon("GET", `/connection_uri?${query}`)).uri);
    if (database) url.pathname = `/${database}`;
    return url.toString();
  };
  return { role: own.owner_name, pooled: await uri(true), direct: await uri(false) };
}

export async function deleteBranch(created, startedAt) {
  try {
    await neon("DELETE", `/branches/${created.branch.id}`);
    console.log(
      `\n→ Branch ${created.branch.name} borrada (${Math.round((Date.now() - startedAt) / 1000)} s en total)`,
    );
  } catch (error) {
    console.error(`No se pudo borrar la branch ${created.branch.name}; Neon la borra sola a las 2 horas.`, error);
  }
}
