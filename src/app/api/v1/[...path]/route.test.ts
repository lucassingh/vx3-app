import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { GET } from "./route";

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "vx3_session" ? { value: cookie.value } : undefined) }),
}));

beforeEach(() => {
  cookie.value = undefined;
});

describe("/api/v1", () => {
  it("sin sesión responde 401", async () => {
    const response = await GET(new Request("http://app.local/api/v1/cobros/caja"));
    expect(response.status).toBe(401);
  });

  it("con sesión atiende el pedido", async () => {
    expect(SESSION_COOKIE).toBe("vx3_session");
    cookie.value = await createSessionToken("eliasllaury@gmail.com");

    const response = await GET(new Request("http://app.local/api/v1/cobros/caja"));

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("cuentas");
  });
});
