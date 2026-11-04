import { defineConfig } from "prisma/config";

// El CLI de Prisma no lee .env.local como Next: lo cargamos si existe. No pisa las
// variables que ya estén definidas (en la CI llegan como secretos).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local (CI o build): se usan las variables del entorno.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Las migraciones van por la conexión directa; la app usa la del pooler (src/db/client.ts).
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
