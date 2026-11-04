import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { limpiarBreadcrumb, limpiarEvento, opcionesDeSentry } from "./sentry";

afterEach(() => {
  vi.unstubAllEnvs();
});

function evento(datos: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, message: "falló algo", ...datos };
}

describe("filtro de datos personales para Sentry", () => {
  it("saca cookies, cuerpo, query string y los headers sensibles del request", () => {
    const limpio = limpiarEvento(
      evento({
        request: {
          url: "https://cli-vx3.vercel.app/api/v1/clientas?telefono=1155554444#ficha",
          method: "POST",
          cookies: { "__Secure-vx3.session_token": "abc" },
          data: { password: "secreta" },
          query_string: "telefono=1155554444",
          env: { REMOTE_ADDR: "190.1.2.3" },
          headers: {
            Cookie: "__Secure-vx3.session_token=abc",
            Authorization: "Bearer xyz",
            "x-forwarded-for": "190.1.2.3",
            "User-Agent": "Mozilla/5.0",
            "content-type": "application/json",
          },
        },
      }),
    );

    expect(limpio.request).toEqual({
      url: "https://cli-vx3.vercel.app/api/v1/clientas",
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0", "content-type": "application/json" },
    });
  });

  it("del usuario deja solo el id, sin IP ni email", () => {
    const conId = limpiarEvento(evento({ user: { id: "u-1", email: "elias@vx3.test", ip_address: "190.1.2.3" } }));
    const sinId = limpiarEvento(evento({ user: { ip_address: "{{auto}}" } }));

    expect(conId.user).toEqual({ id: "u-1" });
    expect(sinId.user).toBeUndefined();
  });

  it("descarta los breadcrumbs de consola y saca la query de las URLs", () => {
    const limpio = limpiarEvento(
      evento({
        breadcrumbs: [
          { category: "console", message: "dni 30111222" },
          { category: "fetch", data: { url: "/api/v1/clientas?dni=30111222", method: "GET", status_code: 200 } },
          { category: "navigation", data: { from: "/clientas?q=ana", to: "/clientas/fichas" } },
        ],
      }),
    );

    expect(limpio.breadcrumbs).toEqual([
      { category: "fetch", data: { url: "/api/v1/clientas", method: "GET", status_code: 200 } },
      { category: "navigation", data: { from: "/clientas", to: "/clientas/fichas" } },
    ]);
    expect(limpiarBreadcrumb({ category: "ui.click", message: "button" })).toEqual({
      category: "ui.click",
      message: "button",
    });
  });

  it("un evento sin request ni usuario pasa igual", () => {
    expect(limpiarEvento(evento())).toEqual(evento());
  });
});

describe("opciones de Sentry", () => {
  it("manda solo desde QA y producción, y con DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");
    vi.stubEnv("APP_COMMIT", "4c4aee5");

    vi.stubEnv("APP_ENV", "production");
    expect(opcionesDeSentry()).toMatchObject({ enabled: true, environment: "production", release: "4c4aee5" });
    vi.stubEnv("APP_ENV", "qa");
    expect(opcionesDeSentry().enabled).toBe(true);
    vi.stubEnv("APP_ENV", "preview");
    expect(opcionesDeSentry().enabled).toBe(false);
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(opcionesDeSentry().enabled).toBe(false);
  });

  it("nunca pide los datos personales por defecto", () => {
    expect(opcionesDeSentry()).toMatchObject({ sendDefaultPii: false, tracesSampleRate: 0 });
  });
});
