import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";
import { serverEnv } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente de Prisma sobre el adapter de Neon, con la conexión del pooler
 * (DATABASE_URL), como recomienda Neon en entornos serverless. Las migraciones
 * usan la directa (prisma.config.ts).
 *
 * Se crea recién cuando alguien lo usa y queda uno solo por proceso: cada
 * cliente abre su propio pool. En desarrollo se guarda en globalThis para que
 * la recarga en caliente no abra uno nuevo en cada cambio.
 */
const globalForDb = globalThis as typeof globalThis & { __vx3Db?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalForDb.__vx3Db) return globalForDb.__vx3Db;

  const connectionString = serverEnv().DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL: la conexión con pooler de Neon (ver .env.example).");
  }
  const client = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  if (process.env.NODE_ENV !== "production") globalForDb.__vx3Db = client;
  return client;
}
