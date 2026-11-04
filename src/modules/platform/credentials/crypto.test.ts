// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cifrar, descifrar, enmascarar } from "./crypto";

const CLAVE = randomBytes(32);
const TOKEN = "token-de-prueba-7c1e";

describe("cifrado de credenciales", () => {
  it("recupera el valor con la misma clave y la misma integración", () => {
    expect(descifrar(cifrar(TOKEN, CLAVE, "dux"), CLAVE, "dux")).toBe(TOKEN);
  });

  it("lo guardado no contiene el valor y cambia en cada cifrado", () => {
    const uno = cifrar(TOKEN, CLAVE, "dux");
    expect(uno).not.toContain(TOKEN);
    expect(Buffer.from(uno.split(".")[3]!, "base64url").toString("utf8")).not.toContain(TOKEN);
    expect(cifrar(TOKEN, CLAVE, "dux")).not.toBe(uno);
  });

  // El error de autenticación del cifrado, no el de formato: si no, estos tests pasan por el motivo equivocado.
  const NO_AUTENTICA = /unable to authenticate/i;

  it("falla con otra clave", () => {
    expect(() => descifrar(cifrar(TOKEN, CLAVE, "dux"), randomBytes(32), "dux")).toThrow(NO_AUTENTICA);
  });

  it("falla si lo guardado se alteró", () => {
    const [version, iv, tag, cifrado] = cifrar(TOKEN, CLAVE, "dux").split(".");
    const alterado = Buffer.from(cifrado!, "base64url");
    alterado[0]! ^= 1;
    expect(() => descifrar([version, iv, tag, alterado.toString("base64url")].join("."), CLAVE, "dux")).toThrow(
      NO_AUTENTICA,
    );
  });

  it("falla si se copia a otra integración", () => {
    expect(() => descifrar(cifrar(TOKEN, CLAVE, "dux"), CLAVE, "meta")).toThrow(NO_AUTENTICA);
  });

  it("falla con un formato desconocido", () => {
    expect(() => descifrar("texto-plano", CLAVE, "dux")).toThrow(/Formato de credencial desconocido/);
  });
});

describe("enmascarar", () => {
  it("deja a la vista solo los últimos 4 caracteres", () => {
    expect(enmascarar(TOKEN)).toBe("••••7c1e");
  });
});
