/**
 * npm run auth:create-admin: crea un usuario admin con una contraseña temporal,
 * que se muestra una sola vez y se cambia al entrar. Sirve para el primer
 * usuario de cada base (local, QA, producción); los demás los crea un admin
 * desde Configuración → Usuarios y roles.
 *
 *   npm run auth:create-admin
 *   npm run auth:create-admin -- --email lucas@masuno.com.ar --nombre "Lucas Singh" --usuario lucas
 *
 * Usa la base de DATABASE_URL (.env.local en local).
 */

import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { getDb } from "@/db/client";
import { getAuth } from "@/modules/platform/auth/auth";
import { temporaryPassword } from "@/modules/platform/users/temporary-password";

const email = z.email("no es un email válido").transform((value) => value.trim().toLowerCase());
const nombre = z.string().trim().min(2, "poné nombre y apellido");
const usuario = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, "de 3 a 30 letras, números, puntos o guiones bajos, sin espacios")
  .or(z.literal(""));

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Fuera de local, las variables vienen del entorno.
  }

  const { values } = parseArgs({
    options: { email: { type: "string" }, nombre: { type: "string" }, usuario: { type: "string" } },
  });
  const consola = createInterface({ input: process.stdin, output: process.stdout });

  async function pedir<T>(pregunta: string, esquema: z.ZodType<T>, valor?: string): Promise<T> {
    for (;;) {
      const respuesta = valor ?? (await consola.question(pregunta));
      const parsed = esquema.safeParse(respuesta);
      if (parsed.success) return parsed.data;
      console.error(`  ${parsed.error.issues[0]?.message ?? "valor inválido"}`);
      valor = undefined;
    }
  }

  const datos = {
    email: await pedir("Email: ", email, values.email),
    nombre: await pedir("Nombre y apellido: ", nombre, values.nombre),
    usuario: await pedir("Usuario para entrar sin el email (opcional, Enter para saltear): ", usuario, values.usuario),
  };
  consola.close();

  const password = temporaryPassword();
  const { user } = await getAuth().api.createUser({
    body: {
      email: datos.email,
      name: datos.nombre,
      password,
      role: "admin",
      data: {
        mustChangePassword: true,
        ...(datos.usuario ? { username: datos.usuario, displayUsername: datos.usuario } : {}),
      },
    },
  });

  console.log(`\nListo: ${user.name} es admin.`);
  console.log(
    `Entrá con ${datos.email}${datos.usuario ? ` o con ${datos.usuario}` : ""} y esta contraseña temporal:\n`,
  );
  console.log(`  ${password}\n`);
  console.log("No se vuelve a mostrar. Al entrar, la app te pide que la cambies.");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      /already exists/i.test(message) ? "Ya hay un usuario con ese email." : `No se pudo crear el usuario: ${message}`,
    );
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
