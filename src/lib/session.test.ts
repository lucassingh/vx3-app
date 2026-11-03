import { describe, expect, it } from "vitest";
import { checkCredentials, createSessionToken, verifySessionToken } from "./session";

describe("credenciales", () => {
  it("acepta solo el usuario de la demo", () => {
    expect(checkCredentials("eliasllaury@gmail.com", "Admin123456!")).toBe(true);
    expect(checkCredentials(" EliasLlaury@gmail.com ", "Admin123456!")).toBe(true);
    expect(checkCredentials("eliasllaury@gmail.com", "admin123456!")).toBe(false);
    expect(checkCredentials("otro@gmail.com", "Admin123456!")).toBe(false);
  });
});

describe("sesión", () => {
  it("valida un token recién creado", async () => {
    const token = await createSessionToken("eliasllaury@gmail.com");
    expect(await verifySessionToken(token)).toMatchObject({ email: "eliasllaury@gmail.com" });
  });

  it("rechaza un token adulterado, vencido o vacío", async () => {
    const token = await createSessionToken("eliasllaury@gmail.com");
    const [body, signature] = token.split(".");
    const forged = `${btoa(JSON.stringify({ email: "x@y.com", exp: Date.now() + 1e9 }))}.${signature}`;

    expect(await verifySessionToken(`${body}.${signature!.slice(0, -2)}xx`)).toBeNull();
    expect(await verifySessionToken(forged)).toBeNull();
    expect(await verifySessionToken(token, Date.now() + 8 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});
