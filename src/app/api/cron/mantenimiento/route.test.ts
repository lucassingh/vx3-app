import type * as NextServer from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const workflow = vi.hoisted(() => ({ start: vi.fn(async () => ({ runId: "wrun_01" })) }));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof NextServer>()),
  connection: async () => {},
}));
vi.mock("workflow/api", () => workflow);
vi.mock("@/workflows/mantenimiento", () => ({ mantenimientoDiario: async () => ({}) }));

const SECRETO = "s".repeat(32);

beforeEach(() => {
  workflow.start.mockClear();
  vi.stubEnv("CRON_SECRET", SECRETO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const llamar = (authorization?: string) =>
  GET(
    new Request("http://app.local/api/cron/mantenimiento", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("/api/cron/mantenimiento", () => {
  it("sin el secreto responde 401 y no arranca nada", async () => {
    expect((await llamar()).status).toBe(401);
    expect((await llamar("Bearer otro")).status).toBe(401);
    expect((await llamar(SECRETO)).status).toBe(401);
    expect(workflow.start).not.toHaveBeenCalled();
  });

  it("si CRON_SECRET no está configurado no deja pasar a nadie", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await llamar("Bearer ")).status).toBe(401);
    expect(workflow.start).not.toHaveBeenCalled();
  });

  it("con el secreto arranca el workflow y responde su id", async () => {
    const response = await llamar(`Bearer ${SECRETO}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, runId: "wrun_01" });
    expect(workflow.start).toHaveBeenCalledTimes(1);
  });
});
