import { connection, NextResponse } from "next/server";
import { serverEnv } from "@/env";
import { cronAutorizado } from "@/lib/cron";
import { logger } from "@/lib/logger";
import { arrancarSincronizacionDux } from "@/workflows/arrancar-dux";

/**
 * Lo llama Vercel Cron (vercel.json): la frecuencia se cambia en esa línea. Arranca
 * la sincronización con DUX y responde enseguida, sin esperar a que termine.
 */
export async function GET(request: Request) {
  // Con cacheComponents, sin esto Next intentaría resolverla en el build.
  await connection();
  const secreto = serverEnv().CRON_SECRET;
  if (!secreto) logger.error("falta CRON_SECRET: la sincronización con DUX no puede correr");
  if (!cronAutorizado(request, secreto)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const arranque = await arrancarSincronizacionDux({ trigger: "cron" });
  if (!arranque.arrancada) {
    logger.warn("sincronización con DUX: ya había una en curso");
    return NextResponse.json({ error: "Ya hay una sincronización en curso." }, { status: 409 });
  }
  logger.info({ runId: arranque.runId }, "sincronización con DUX iniciada");
  return NextResponse.json({ ok: true, runId: arranque.runId });
}
