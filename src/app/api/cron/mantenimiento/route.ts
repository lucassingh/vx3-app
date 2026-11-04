import { connection, NextResponse } from "next/server";
import { start } from "workflow/api";
import { serverEnv } from "@/env";
import { cronAutorizado } from "@/lib/cron";
import { logger } from "@/lib/logger";
import { mantenimientoDiario } from "@/workflows/mantenimiento";

/**
 * Lo llama Vercel Cron una vez por día (vercel.json): arranca el Workflow de
 * mantenimiento y responde enseguida, sin esperar a que termine.
 */
export async function GET(request: Request) {
  // Con cacheComponents, sin esto Next intentaría resolverla en el build.
  await connection();
  const secreto = serverEnv().CRON_SECRET;
  if (!secreto) logger.error("falta CRON_SECRET: el mantenimiento no puede correr");
  if (!cronAutorizado(request, secreto)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const run = await start(mantenimientoDiario);
  logger.info({ runId: run.runId }, "mantenimiento diario iniciado");
  return NextResponse.json({ ok: true, runId: run.runId });
}
