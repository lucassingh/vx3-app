import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Tres proyectos:
 *   unit         *.test.ts      entorno node (si uno necesita el DOM, lo pide con
 *                               `// @vitest-environment jsdom` arriba de todo)
 *   components   *.test.tsx     jsdom + Testing Library
 *   integration  *.int.test.ts  base real: solo con npm run test:int, que crea una
 *                               branch efímera de Neon, migra, corre y la borra
 *
 * `npm test` corre unit y components; `npm run test:coverage`, lo mismo con cobertura.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Usa los alias de tsconfig.json (@/…).
    tsconfigPaths: true,
    alias: {
      // "server-only" falla fuera de React Server Components; en tests se neutraliza.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: { name: "components", environment: "jsdom", include: ["src/**/*.test.tsx"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          // Comparten la base: uno por vez, y con margen para que arranque el compute de Neon.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/generated/**",
        "src/mocks/seed/**",
        "src/**/*.d.ts",
        "src/app/**/{page,layout,loading,error,not-found}.tsx",
      ],
      reporter: ["text-summary", "html"],
      // La meta (tecnica_doc §8) es 80 % global y 95 % en los servicios. El global
      // es el piso medido (03/11/2026, fase 1.2), cuando casi todo es la maqueta de
      // la UI: sirve para que no baje y se sube a medida que entra el código real.
      // Las piezas base y el control de acceso ya están en la meta. La auth y la
      // gestión de usuarios se prueban con la base real (npm run test:int), que no
      // suma a este reporte.
      thresholds: {
        statements: 35,
        branches: 28,
        functions: 30,
        lines: 34,
        "src/{env.ts,lib/{errors,result,money,dates,logger,action}.ts,lib/api/dispatch.ts,modules/platform/{permissions,access}.ts}":
          {
            statements: 95,
            branches: 90,
            functions: 95,
            lines: 95,
          },
      },
    },
  },
});
