import { connection } from "next/server";
import { revisarSalud } from "@/modules/platform/health";

/**
 * Chequeo de salud, público (el proxy no cubre /api). Con `?base=1` también
 * prueba la base y responde 503 si no contesta: lo usan los deploys después de
 * publicar. El monitor de disponibilidad llama sin `base`, para no tener
 * despierta toda la noche la base de Neon (se duerme a los 5 minutos sin uso).
 */
export async function GET(request: Request) {
  // Con cacheComponents, sin esto Next intentaría resolverla en el build.
  await connection();
  const conBase = new URL(request.url).searchParams.get("base") === "1";
  const salud = await revisarSalud({ conBase });
  return Response.json(salud, { status: salud.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
