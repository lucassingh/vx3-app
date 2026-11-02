import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
