import { connection, NextResponse } from "next/server";
import { serverEnv } from "@/env";
import { cronAutorizado } from "@/lib/cron";
import { logger } from "@/lib/logger";
import { arrancarHistorialDux } from "@/workflows/arrancar-dux";

/**
 * Trae los últimos 12 meses de ventas. No está en vercel.json: se dispara a mano, una
 * vez por ambiente y avisándole antes a VX3 (`docs/operacion.md`). Si se corta, volver
 * a llamarla solo trae lo que faltó.
 */
export async function POST(request: Request) {
  // Con cacheComponents, sin esto Next intentaría resolverla en el build.
  await connection();
  if (!cronAutorizado(request, serverEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const arranque = await arrancarHistorialDux({ trigger: "manual", triggeredBy: "API" });
  if (!arranque.arrancada) {
    return NextResponse.json({ error: "Ya hay una sincronización en curso." }, { status: 409 });
  }
  logger.info({ runId: arranque.runId }, "historial de ventas de DUX iniciado");
  return NextResponse.json({ ok: true, runId: arranque.runId });
}
