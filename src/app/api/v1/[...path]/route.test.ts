import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/modules/platform/auth/session";
import { usuarioDePrueba } from "@/test/users";
import { GET } from "./route";

const sesion = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("@/modules/platform/auth/session", () => ({ getSessionUser: async () => sesion.user }));

beforeEach(() => {
  sesion.user = null;
});

describe("/api/v1", () => {
  it("sin sesión responde 401", async () => {
    const response = await GET(new Request("http://app.local/api/v1/cobros/caja"));
    expect(response.status).toBe(401);
  });

  it("con sesión atiende el pedido", async () => {
    sesion.user = usuarioDePrueba("admin");

    const response = await GET(new Request("http://app.local/api/v1/cobros/caja"));

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("cuentas");
  });
});
