import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineAction } from "./action";
import { ConflictError } from "./errors";
import { logger } from "./logger";
import { usuarioDePrueba } from "@/test/users";
import type { SessionUser } from "@/modules/platform/auth/session";

const sesion = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("@/modules/platform/auth/session", () => ({ getSessionUser: async () => sesion.user }));

const handler = vi.fn(async ({ sku, cantidad }: { sku: string; cantidad: number }) => `${sku} × ${cantidad}`);

const reservar = defineAction({
  name: "stock.reservar",
  input: z.object({ sku: z.string().trim().toUpperCase(), cantidad: z.coerce.number().int().positive() }),
  permission: "settings.credentials",
  handler,
});

beforeEach(() => {
  handler.mockClear();
  sesion.user = usuarioDePrueba("admin");
});

describe("defineAction", () => {
  it("con sesión y datos válidos ejecuta el handler con la entrada ya parseada", async () => {
    const result = await reservar({ sku: " msu2 ", cantidad: "6" as unknown as number });

    expect(result).toEqual({ ok: true, data: "MSU2 × 6" });
    expect(handler).toHaveBeenCalledWith(
      { sku: "MSU2", cantidad: 6 },
      expect.objectContaining({
        user: usuarioDePrueba("admin"),
        requestId: expect.any(String),
      }),
    );
  });

  it("sin sesión no ejecuta nada", async () => {
    sesion.user = null;

    const result = await reservar({ sku: "MSU2", cantidad: 6 });

    expect(result).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "La sesión venció: volvé a entrar." },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("sin el permiso no ejecuta nada", async () => {
    sesion.user = usuarioDePrueba("postventa");

    const result = await reservar({ sku: "MSU2", cantidad: 6 });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("con permission null alcanza con tener sesión", async () => {
    sesion.user = usuarioDePrueba("solo_lectura");
    const propia = defineAction({ name: "perfil.ver", input: z.null(), permission: null, handler: async () => "ok" });

    expect(await propia(null)).toEqual({ ok: true, data: "ok" });
  });

  it("con datos inválidos devuelve el error de cada campo", async () => {
    const result = await reservar({ sku: "MSU2", cantidad: -1 });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", fieldErrors: { cantidad: [expect.any(String)] } },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("un error de dominio llega a la UI con su mensaje", async () => {
    handler.mockRejectedValueOnce(new ConflictError("Ese pedido ya está facturado."));

    const result = await reservar({ sku: "MSU2", cantidad: 6 });

    expect(result).toEqual({ ok: false, error: { code: "CONFLICT", message: "Ese pedido ya está facturado." } });
  });

  it("un error inesperado se registra y la UI recibe un mensaje genérico con el código", async () => {
    const logError = vi.fn();
    const child = vi.spyOn(logger, "child").mockReturnValueOnce({
      info: vi.fn(),
      warn: vi.fn(),
      error: logError,
    } as unknown as ReturnType<typeof logger.child>);
    handler.mockRejectedValueOnce(new Error("connection reset"));

    const result = await reservar({ sku: "MSU2", cantidad: 6 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL");
    expect(result.error.message).not.toContain("connection reset");
    expect(result.error.message).toContain(result.error.requestId?.slice(-8));
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.any(String));
    child.mockRestore();
  });

  it("deja pasar los redirect de Next", async () => {
    handler.mockImplementationOnce(async () => redirect("/login"));

    await expect(reservar({ sku: "MSU2", cantidad: 6 })).rejects.toThrow("NEXT_REDIRECT");
  });
});
