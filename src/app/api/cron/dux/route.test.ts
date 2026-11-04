import type * as NextServer from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const arranque = vi.hoisted(() => ({ arrancarSincronizacionDux: vi.fn() }));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof NextServer>()),
  connection: async () => {},
}));
vi.mock("@/workflows/arrancar-dux", () => arranque);

const SECRETO = "s".repeat(32);

beforeEach(() => {
  arranque.arrancarSincronizacionDux.mockReset();
  arranque.arrancarSincronizacionDux.mockResolvedValue({ arrancada: true, runId: "wrun_01" });
  vi.stubEnv("CRON_SECRET", SECRETO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const llamar = (authorization?: string) =>
  GET(new Request("http://app.local/api/cron/dux", { headers: authorization ? { authorization } : {} }));

describe("/api/cron/dux", () => {
  it("sin el secreto responde 401 y no arranca nada", async () => {
    expect((await llamar()).status).toBe(401);
    expect((await llamar("Bearer otro")).status).toBe(401);
    expect(arranque.arrancarSincronizacionDux).not.toHaveBeenCalled();
  });

  it("si CRON_SECRET no está configurado no deja pasar a nadie", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await llamar("Bearer ")).status).toBe(401);
    expect(arranque.arrancarSincronizacionDux).not.toHaveBeenCalled();
  });

  it("con el secreto arranca y responde enseguida, como corrida del cron", async () => {
    const response = await llamar(`Bearer ${SECRETO}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, runId: "wrun_01" });
    expect(arranque.arrancarSincronizacionDux).toHaveBeenCalledWith({ trigger: "cron" });
  });

  it("con una corrida en curso avisa con un 409", async () => {
    arranque.arrancarSincronizacionDux.mockResolvedValue({ arrancada: false });

    const response = await llamar(`Bearer ${SECRETO}`);

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("en curso");
  });
});
