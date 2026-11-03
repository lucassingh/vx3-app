"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { defineAction } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fail, ok, type Result } from "@/lib/result";
import { getAuth, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./auth";
import {
  bloqueadoHasta,
  clavesDeIntento,
  esperaLegible,
  ipDelCliente,
  LIMITE,
  registrarExito,
  registrarFallo,
} from "./throttle";

/**
 * Entrar, salir y cambiar la contraseña. Entrar es la única acción pública:
 * no pasa por defineAction porque todavía no hay sesión.
 */

const INVALID_CREDENTIALS = "El email, el usuario o la contraseña no son correctos.";

const signInInput = z.object({
  /** Email o nombre de usuario. */
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export type SignInData = { name: string; mustChangePassword: boolean };

function demasiadosIntentos(hasta: Date): Result<never> {
  return fail({
    code: "TOO_MANY_REQUESTS",
    message: `Demasiados intentos fallidos. Por seguridad, esperá ${esperaLegible(hasta)} y probá de nuevo.`,
  });
}

export async function signIn(raw: z.input<typeof signInInput>): Promise<Result<SignInData>> {
  const parsed = signInInput.safeParse(raw);
  if (!parsed.success) return fail({ code: "VALIDATION", message: "Completá el email o usuario y la contraseña." });
  const { identifier, password } = parsed.data;

  const requestHeaders = await headers();
  const claves = clavesDeIntento(identifier, ipDelCliente(requestHeaders));
  // Bloqueado se rechaza antes de mirar la contraseña, aunque sea la correcta.
  const bloqueo = await bloqueadoHasta([claves.user, claves.ip]);
  if (bloqueo) return demasiadosIntentos(bloqueo);

  try {
    const auth = getAuth();
    const { user } = identifier.includes("@")
      ? await auth.api.signInEmail({ body: { email: identifier, password }, headers: requestHeaders })
      : await auth.api.signInUsername({ body: { username: identifier, password }, headers: requestHeaders });

    await registrarExito(claves.user);
    const actualizado = await getDb().user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: { name: true, mustChangePassword: true },
    });
    return ok(actualizado);
  } catch (error) {
    if (error instanceof APIError) {
      // Desactivado por un admin: el mensaje lo arma el plugin admin (auth.ts).
      if (error.statusCode === 403) return fail({ code: "FORBIDDEN", message: error.message });

      const [porUsuario, porIp] = await Promise.all([
        registrarFallo(claves.user, LIMITE.user),
        registrarFallo(claves.ip, LIMITE.ip),
      ]);
      const recienBloqueado = porUsuario ?? porIp;
      if (recienBloqueado) return demasiadosIntentos(recienBloqueado);
      return fail({ code: "UNAUTHENTICATED", message: INVALID_CREDENTIALS });
    }
    logger.error({ err: error }, "error inesperado al entrar");
    return fail({ code: "INTERNAL", message: "No pudimos verificar tus datos. Probá de nuevo en un rato." });
  }
}

export async function signOut(): Promise<Result<null>> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch (error) {
    // Sin sesión no hay nada que cerrar; la cookie, si quedó, ya no sirve.
    if (!(error instanceof APIError)) logger.error({ err: error }, "error inesperado al salir");
  }
  return ok(null);
}

const nuevaPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(MAX_PASSWORD_LENGTH, `Tiene que tener como mucho ${MAX_PASSWORD_LENGTH} caracteres.`);

export const changePassword = defineAction({
  name: "auth.cambiar_password",
  input: z
    .object({
      actual: z.string().min(1, "Escribí tu contraseña actual."),
      nueva: nuevaPassword,
      repetida: z.string(),
    })
    .refine((datos) => datos.nueva === datos.repetida, {
      path: ["repetida"],
      message: "No coincide con la contraseña nueva.",
    })
    .refine((datos) => datos.nueva !== datos.actual, {
      path: ["nueva"],
      message: "Tiene que ser distinta de la actual.",
    }),
  permission: null,
  handler: async ({ actual, nueva }, { user }) => {
    try {
      // Cierra las otras sesiones y deja abierta solo esta, con una cookie nueva.
      await getAuth().api.changePassword({
        body: { currentPassword: actual, newPassword: nueva, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 400) {
        throw new ValidationError("La contraseña actual no es correcta.", {
          actual: ["La contraseña actual no es correcta."],
        });
      }
      throw error;
    }
    await getDb().user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    return null;
  },
});
