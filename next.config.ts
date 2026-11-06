import { withSentryConfig } from "@sentry/nextjs/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const { version } = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf8")) as { version: string };

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Quedan fijas en el build: las muestran /api/health y los errores de Sentry.
  // Los deploys de GitHub Actions ponen APP_ENV (qa, preview o production).
  env: {
    APP_VERSION: version,
    APP_COMMIT: process.env.GITHUB_SHA ?? "local",
    APP_ENV: process.env.APP_ENV ?? "local",
  },
  // Las fotos subidas en la app. Las de Drive no pasan por el optimizador.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  // El indicador de desarrollo de Next tapaba "Cerrar sesión" abajo a la izquierda.
  devIndicators: { position: "bottom-right" },
  turbopack: {
    // Fija la raíz al proyecto aunque haya lockfiles en carpetas superiores.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Los source maps se suben a Sentry solo en los deploys de QA y producción, que
// traen SENTRY_AUTH_TOKEN, y después se borran: no quedan públicos.
const subirSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

// withWorkflow habilita "use workflow" y "use step" (src/workflows/). Sentry va por fuera.
export default withSentryConfig(withWorkflow(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: "cli-vx3",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.GITHUB_SHA, create: subirSourceMaps },
  sourcemaps: { disable: !subirSourceMaps },
  silent: !subirSourceMaps,
  telemetry: false,
});
