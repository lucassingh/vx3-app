import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Chequeo optimista (tecnica_doc §6.2): sin cookie de sesión, todas las
 * pantallas van a /login. No consulta la base porque corre en cada request; la
 * verificación real (sesión vigente, usuario activo, permisos) la hacen el
 * layout, cada página, la API y cada Server Action.
 *
 * Con cookie no se saca a nadie de /login: si la sesión venció, la cookie
 * sigue ahí y el login es justamente lo que hace falta.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getSessionCookie(request, { cookiePrefix: "vx3" }));
  if (!hasSessionCookie && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  // La API, los assets y las imágenes no pasan por acá.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|logo.svg|brand/).*)"],
};
