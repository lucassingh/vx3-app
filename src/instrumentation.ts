import * as Sentry from "@sentry/nextjs";

/** Next lo ejecuta una vez al levantar el servidor. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Si falta una variable o tiene mal formato, la app no arranca y el error dice cuál y qué hacer.
    const { validateEnv } = await import("./env");
    validateEnv();
  }
  // Fuera de QA y producción queda apagado (src/lib/sentry.ts).
  const { opcionesDeSentry } = await import("./lib/sentry");
  Sentry.init(opcionesDeSentry());
}

/** Los errores de cada request del servidor (páginas, Server Actions, rutas) van a Sentry. */
export const onRequestError = Sentry.captureRequestError;
