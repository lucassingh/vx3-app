import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/modules/platform/auth/session";
import { usuarioDePrueba } from "@/test/users";
import { GET } from "./route";

const sesion = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("@/modules/platform/auth/session", () => ({ getSessionUser: async () => sesion.user }));

beforeEach(() => {
  sesion.user = null;
});

describe("/api/error-de-prueba", () => {
  it("sin sesión responde 401", async () => {
    expect((await GET()).status).toBe(401);
  });

  it("sin permiso de plataforma responde 403", async () => {
    sesion.user = usuarioDePrueba("operaciones");
    expect((await GET()).status).toBe(403);
  });

  it("a un admin le tira el error de prueba", async () => {
    sesion.user = usuarioDePrueba("admin");
    await expect(GET()).rejects.toThrow(/Error de prueba para Sentry/);
  });
});
