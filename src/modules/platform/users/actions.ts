"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { defineAction } from "@/lib/action";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getAuth } from "../auth/auth";
import { ROLES } from "../permissions";
import { temporaryPassword } from "./temporary-password";

/**
 * Gestión de usuarios: solo admin (plataforma.editar). Nadie se cambia el rol,
 * se desactiva, se resetea la contraseña ni se cierra las sesiones a sí mismo
 * desde acá: así siempre queda al menos un admin y nadie se deja afuera solo.
 */

const PERMISO = "plataforma.editar";

const usuarioId = z.object({ userId: z.uuid("Usuario inválido.") });

async function existente(userId: string) {
  const usuario = await getDb().user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
  if (!usuario) throw new NotFoundError("Ese usuario ya no existe. Recargá la página.");
  return usuario;
}

function noAVosMismo(userId: string, yo: string, mensaje: string) {
  if (userId === yo) throw new ConflictError(mensaje);
}

export const crearUsuario = defineAction({
  name: "usuarios.crear",
  input: z.object({
    nombre: z.string().trim().min(2, "Poné nombre y apellido.").max(80),
    email: z.email("Revisá el email.").trim().toLowerCase(),
    usuario: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_.]{3,30}$/, "De 3 a 30 letras, números, puntos o guiones bajos, sin espacios.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    rol: z.enum(ROLES, "Elegí un rol."),
    puesto: z.string().trim().max(60).optional(),
  }),
  permission: PERMISO,
  handler: async ({ nombre, email, usuario, rol, puesto }, { audit }) => {
    const db = getDb();
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictError("Ya hay un usuario con ese email.");
    }
    if (usuario && (await db.user.findUnique({ where: { username: usuario }, select: { id: true } }))) {
      throw new ConflictError(`El usuario "${usuario}" ya lo usa otra persona. Probá con otro.`);
    }

    const passwordTemporal = temporaryPassword();
    const { user } = await getAuth().api.createUser({
      body: {
        email,
        name: nombre,
        password: passwordTemporal,
        role: rol,
        data: {
          mustChangePassword: true,
          ...(puesto ? { jobTitle: puesto } : {}),
          ...(usuario ? { username: usuario, displayUsername: usuario } : {}),
        },
      },
      headers: await headers(),
    });
    await audit({
      action: "usuario.creado",
      entityType: "user",
      entityId: user.id,
      after: { nombre, email, usuario: usuario ?? null, rol, puesto: puesto ?? null },
    });
    return { id: user.id, nombre: user.name, passwordTemporal };
  },
});

export const cambiarRol = defineAction({
  name: "usuarios.cambiar_rol",
  input: usuarioId.extend({ rol: z.enum(ROLES, "Elegí un rol.") }),
  permission: PERMISO,
  handler: async ({ userId, rol }, { user, audit }) => {
    noAVosMismo(userId, user.id, "No podés cambiar tu propio rol: pedíselo a otro admin.");
    const previo = await existente(userId);
    await getAuth().api.setRole({ body: { userId, role: rol }, headers: await headers() });
    await audit({
      action: "usuario.rol",
      entityType: "user",
      entityId: userId,
      before: { nombre: previo.name, rol: previo.role },
      after: { nombre: previo.name, rol },
    });
    return null;
  },
});

export const desactivarUsuario = defineAction({
  name: "usuarios.desactivar",
  input: usuarioId,
  permission: PERMISO,
  handler: async ({ userId }, { user, audit }) => {
    noAVosMismo(userId, user.id, "No podés desactivar tu propio usuario.");
    const { name } = await existente(userId);
    // Además de bloquear el ingreso, cierra todas sus sesiones.
    await getAuth().api.banUser({
      body: { userId, banReason: `Desactivado por ${user.name}` },
      headers: await headers(),
    });
    await audit({ action: "usuario.desactivado", entityType: "user", entityId: userId, after: { nombre: name } });
    return null;
  },
});

export const reactivarUsuario = defineAction({
  name: "usuarios.reactivar",
  input: usuarioId,
  permission: PERMISO,
  handler: async ({ userId }, { audit }) => {
    const { name } = await existente(userId);
    await getAuth().api.unbanUser({ body: { userId }, headers: await headers() });
    await audit({ action: "usuario.reactivado", entityType: "user", entityId: userId, after: { nombre: name } });
    return null;
  },
});

export const cerrarSesiones = defineAction({
  name: "usuarios.cerrar_sesiones",
  input: usuarioId,
  permission: PERMISO,
  handler: async ({ userId }, { user, audit }) => {
    noAVosMismo(userId, user.id, "Para cerrar tu sesión usá Salir, en tu menú.");
    const { name } = await existente(userId);
    await getAuth().api.revokeUserSessions({ body: { userId }, headers: await headers() });
    await audit({
      action: "usuario.sesiones_cerradas",
      entityType: "user",
      entityId: userId,
      after: { nombre: name },
    });
    return null;
  },
});

export const resetearPassword = defineAction({
  name: "usuarios.resetear_password",
  input: usuarioId,
  permission: PERMISO,
  handler: async ({ userId }, { user, audit }) => {
    noAVosMismo(userId, user.id, "Tu contraseña la cambiás desde Mi perfil.");
    const { name } = await existente(userId);
    const auth = getAuth();
    const requestHeaders = await headers();
    const passwordTemporal = temporaryPassword();
    try {
      await auth.api.setUserPassword({ body: { userId, newPassword: passwordTemporal }, headers: requestHeaders });
    } catch (error) {
      // Un usuario sin contraseña (no debería pasar: todos se crean con una).
      if (error instanceof APIError) throw new ConflictError("Ese usuario no tiene contraseña para resetear.");
      throw error;
    }
    await auth.api.revokeUserSessions({ body: { userId }, headers: requestHeaders });
    await getDb().user.update({ where: { id: userId }, data: { mustChangePassword: true } });
    // La contraseña temporal nunca va al registro.
    await audit({
      action: "usuario.password_reseteada",
      entityType: "user",
      entityId: userId,
      after: { nombre: name },
    });
    return { passwordTemporal };
  },
});
