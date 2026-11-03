import { describe, expect, it } from "vitest";
import { temporaryPassword } from "./temporary-password";

describe("temporaryPassword", () => {
  it("son 16 caracteres sin ambiguos, en grupos de 4", () => {
    for (let vez = 0; vez < 200; vez++) {
      const password = temporaryPassword();
      expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{4}(-[a-km-zA-HJ-NP-Z2-9]{4}){3}$/);
    }
  });

  it("no se repite", () => {
    const vistas = new Set(Array.from({ length: 500 }, temporaryPassword));
    expect(vistas.size).toBe(500);
  });
});
