"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { siteConfig } from "@/config/site";
import "./globals.css";

/**
 * Error en el layout raíz: reemplaza toda la página, así que trae su propio
 * html y body. Los errores del servidor ya llegan a Sentry por onRequestError
 * (vienen con digest); acá se mandan los que nacen en el navegador.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={siteConfig.lang}>
      <body className="grid min-h-dvh place-items-center p-6">
        <main role="alert" className="max-w-md text-center">
          <p className="font-mono text-sm text-muted-foreground">Error</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">La app no pudo cargar</h1>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Probá de nuevo en unos segundos. Si el problema sigue, compartí este código con soporte:{" "}
            <span className="font-mono">{error.digest ?? "sin código"}</span>
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
