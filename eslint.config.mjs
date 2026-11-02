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
  // Prettier formatea; ESLint no opina de formato.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
