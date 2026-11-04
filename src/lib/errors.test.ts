import { describe, expect, it } from "vitest";
import {
  AppError,
  ExternalServiceError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "./errors";
import { fail, ok, toActionError } from "./result";

describe("errores de dominio", () => {
  it("cada uno lleva su código, su estado HTTP y su nombre", () => {
    const error = new NotFoundError("No encontramos el pedido V-1037.");
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "NOT_FOUND", status: 404, name: "NotFoundError" });
    expect(new UnauthenticatedError().status).toBe(401);
    expect(new ForbiddenError().message).toMatch(/permiso/);
  });

  it("ExternalServiceError dice qué servicio falló y guarda la causa", () => {
    const cause = new Error("ETIMEDOUT");
    const error = new ExternalServiceError("DUX", "DUX no respondió. Probá en unos minutos.", { cause });
    expect(error).toMatchObject({ code: "EXTERNAL_SERVICE", status: 502, service: "DUX", cause });
  });

  it("isAppError distingue los errores de dominio de los inesperados", () => {
    expect(isAppError(new ValidationError("Revisá los datos."))).toBe(true);
    expect(isAppError(new Error("boom"))).toBe(false);
    expect(isAppError("boom")).toBe(false);
  });
});

describe("resultado tipado", () => {
  it("ok y fail arman objetos planos", () => {
    expect(ok(3)).toEqual({ ok: true, data: 3 });
    expect(fail({ code: "CONFLICT", message: "Ya existe." })).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "Ya existe." },
    });
  });

  it("toActionError pasa el código y el mensaje, y los errores por campo si hay", () => {
    expect(toActionError(new NotFoundError("No está."))).toEqual({ code: "NOT_FOUND", message: "No está." });
    expect(toActionError(new ValidationError("Revisá los datos.", { sku: ["Falta el SKU."] }))).toEqual({
      code: "VALIDATION",
      message: "Revisá los datos.",
      fieldErrors: { sku: ["Falta el SKU."] },
    });
  });
});
