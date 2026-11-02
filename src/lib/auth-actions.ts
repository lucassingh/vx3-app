"use server";

import { cookies } from "next/headers";
import {
  checkCredentials,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
} from "@/lib/session";

export type SignInResult = { ok: true } | { ok: false; message: string };

export async function signIn(credentials: {
  email: string;
  password: string;
}): Promise<SignInResult> {
  if (!checkCredentials(credentials.email, credentials.password)) {
    return { ok: false, message: "El email o la contraseña no son correctos." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(credentials.email.trim().toLowerCase()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return { ok: true };
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return { ok: true };
}
