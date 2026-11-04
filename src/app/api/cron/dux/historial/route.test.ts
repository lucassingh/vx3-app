import type * as NextServer from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const arranque = vi.hoisted(() => ({ arrancarHistorialDux: vi.fn() }));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof NextServer>()),
  connection: async () => {},
}));
vi.mock("@/workflows/arrancar-dux", () => arranque);

const SECRETO = "s".repeat(32);

beforeEach(() => {
  arranque.arrancarHistorialDux.mockReset();
  arranque.arrancarHistorialDux.mockResolvedValue({ arrancada: true, runId: "wrun_02" });
  vi.stubEnv("CRON_SECRET", SECRETO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const llamar = (authorization?: string) =>
  POST(
    new Request("http://app.local/api/cron/dux/historial", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );

describe("/api/cron/dux/historial", () => {
  it("sin el secreto responde 401 y no arranca nada", async () => {
    expect((await llamar()).status).toBe(401);
    expect(arranque.arrancarHistorialDux).not.toHaveBeenCalled();
  });

  it("con el secreto lo arranca como corrida manual", async () => {
    const response = await llamar(`Bearer ${SECRETO}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, runId: "wrun_02" });
    expect(arranque.arrancarHistorialDux).toHaveBeenCalledWith({ trigger: "manual", triggeredBy: "API" });
  });

  it("con una corrida en curso avisa con un 409", async () => {
    arranque.arrancarHistorialDux.mockResolvedValue({ arrancada: false });

    expect((await llamar(`Bearer ${SECRETO}`)).status).toBe(409);
  });
});
