import type * as NextServer from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const base = vi.hoisted(() => ({ ping: vi.fn<() => Promise<unknown>>() }));

vi.mock("next/server", async (original) => ({
  ...(await original<typeof NextServer>()),
  connection: async () => {},
}));
vi.mock("@/db/client", () => ({ getDb: () => ({ $queryRaw: base.ping }) }));

beforeEach(() => {
  base.ping.mockReset();
  vi.stubEnv("APP_VERSION", "0.1.0");
  vi.stubEnv("APP_COMMIT", "4f864a6");
  vi.stubEnv("APP_ENV", "qa");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const pedir = (query = "") => GET(new Request(`http://app.local/api/health${query}`));

describe("/api/health", () => {
  it("sin ?base responde la versión, el commit y el ambiente, sin tocar la base", async () => {
    const response = await pedir();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, version: "0.1.0", commit: "4f864a6", ambiente: "qa" });
    expect(base.ping).not.toHaveBeenCalled();
  });

  it("con ?base=1 y la base contestando responde 200", async () => {
    base.ping.mockResolvedValue([{ "?column?": 1 }]);

    const response = await pedir("?base=1");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, base: { ok: true, ms: expect.any(Number) } });
  });

  it("con ?base=1 y la base con error responde 503", async () => {
    base.ping.mockRejectedValue(new Error("connection refused"));

    const response = await pedir("?base=1");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, base: { ok: false } });
  });

  it("si la base no contesta en 5 segundos responde 503", async () => {
    vi.useFakeTimers();
    base.ping.mockReturnValue(new Promise(() => {}));

    const pendiente = pedir("?base=1");
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await pendiente;

    expect(response.status).toBe(503);
  });

  it("no expone nada más que el estado", async () => {
    vi.unstubAllEnvs();
    base.ping.mockResolvedValue([]);

    const body = await (await pedir("?base=1")).json();

    expect(Object.keys(body).sort()).toEqual(["ambiente", "base", "commit", "ok", "version"]);
    expect(body).toMatchObject({ version: "0.0.0", commit: "local", ambiente: "local" });
  });
});
