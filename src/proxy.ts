import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Protege todas las pantallas: sin sesión válida se va a /login, y con sesión
 * /login vuelve al inicio. Solo lee la cookie (chequeo optimista, sin base).
 */
export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/login";

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  // La API simulada, los assets y las imágenes no pasan por acá.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|logo.svg|brand/).*)"],
};
