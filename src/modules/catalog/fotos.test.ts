import { describe, expect, it } from "vitest";
import { CLAVE_DE_FOTO, claveParaSubir, FOTO_MAX_BYTES, moverFoto, problemaDeLaFoto } from "./fotos";

describe("problemaDeLaFoto", () => {
  it.each([
    ["image/jpeg", 1000],
    ["image/png", FOTO_MAX_BYTES],
    ["image/webp", 1],
  ])("%s de %d bytes pasa", (type, size) => {
    expect(problemaDeLaFoto({ type, size })).toBeNull();
  });

  it.each([
    ["image/heic", "JPG"],
    ["application/pdf", "JPG"],
    ["image/svg+xml", "JPG"],
    ["", "JPG"],
  ])("%s no pasa", (type, mensaje) => {
    expect(problemaDeLaFoto({ type, size: 1000 })).toContain(mensaje);
  });

  it("una de más de 10 MB no pasa", () => {
    expect(problemaDeLaFoto({ type: "image/jpeg", size: FOTO_MAX_BYTES + 1 })).toBe("Pesa más de 10 MB.");
  });

  it("un archivo vacío no pasa", () => {
    expect(problemaDeLaFoto({ type: "image/jpeg", size: 0 })).toBe("El archivo está vacío.");
  });
});

describe("claveParaSubir", () => {
  it.each([
    ["Foto Comercial Ñandú.JPG", "catalogo/foto-comercial-nandu.jpg"],
    ["CJALN24-1.jpeg", "catalogo/cjaln24-1.jpeg"],
    ["sin extension", "catalogo/sin-extension"],
    ["🌸🌸.png", "catalogo/foto.png"],
    ["../../otra-carpeta/x.png", "catalogo/otra-carpeta-x.png"],
    [".oculto", "catalogo/oculto"],
  ])("%s queda %s", (nombre, clave) => {
    expect(claveParaSubir(nombre)).toBe(clave);
    expect(claveParaSubir(nombre)).toMatch(CLAVE_DE_FOTO);
  });
});

describe("CLAVE_DE_FOTO", () => {
  it.each(["otra/x.png", "catalogo/sub/x.png", "catalogo/", "/catalogo/x.png", "catalogo/x y.png"])(
    "%s no es una foto del catálogo",
    (clave) => {
      expect(clave).not.toMatch(CLAVE_DE_FOTO);
    },
  );
});

describe("moverFoto", () => {
  const fotos = ["a", "b", "c"];

  it("hacer principal lleva la foto al principio, y las demás conservan su orden", () => {
    expect(moverFoto(fotos, 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("mueve una posición para cualquier lado", () => {
    expect(moverFoto(fotos, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moverFoto(fotos, 2, 1)).toEqual(["a", "c", "b"]);
  });

  it("fuera de la lista no cambia nada, y nunca toca la original", () => {
    expect(moverFoto(fotos, 0, -1)).toEqual(fotos);
    expect(moverFoto(fotos, 2, 3)).toEqual(fotos);
    expect(moverFoto(fotos, 5, 0)).toEqual(fotos);
    expect(fotos).toEqual(["a", "b", "c"]);
  });
});
