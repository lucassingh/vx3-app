import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

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

export default nextConfig;
