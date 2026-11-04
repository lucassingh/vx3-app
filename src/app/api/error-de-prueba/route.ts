import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/platform/auth/session";
import { can } from "@/modules/platform/permissions";

/**
 * Tira un error a propósito para comprobar que Sentry lo recibe, con su commit
 * y sin datos personales (docs/operacion.md). Solo para quien administra la
 * plataforma.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión." }, { status: 401 });
  if (!can(user.role, "plataforma.editar")) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  throw new Error(`Error de prueba para Sentry (${new Date().toISOString()})`);
}
