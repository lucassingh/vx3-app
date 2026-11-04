import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "sonner", message: "Importá toast desde @/lib/toast (CLAUDE.md, Avisos)." }] },
      ],
    },
  },
  // Los únicos que hablan con sonner directo: el contenedor y el wrapper.
  { files: ["src/lib/toast.ts", "src/components/ui/toaster.tsx"], rules: { "no-restricted-imports": "off" } },
  // Los scripts de línea de comandos escriben en la consola a propósito.
  { files: ["prisma/**", "scripts/**"], rules: { "no-console": "off" } },
  // Prettier formatea; ESLint no opina de formato.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cliente de Prisma generado.
    "src/generated/**",
    "coverage/**",
    // Rutas que genera el compilador de los Workflows en cada build.
    "src/app/.well-known/workflow/**",
  ]),
]);

export default eslintConfig;
