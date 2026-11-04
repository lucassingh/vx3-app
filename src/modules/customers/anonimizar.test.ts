import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import { anonimizarClienta, hayQueAnonimizar } from "./anonimizar";
import { telefonoNormalizado } from "./telefono";

const CLAVE = "A".repeat(43);
const OTRA_CLAVE = "B".repeat(43);

const clienta = (cambios: Partial<ErpClienta> = {}): ErpClienta => ({
  id: 7,
  nombre: "NOMBRE REAL",
  nombrePila: "PILA REAL",
  telefono: "+5491144445555",
  email: "real@correo.com",
  provincia: "Buenos Aires",
  localidad: "Localidad Real",
  habilitada: true,
  creadaEl: "2026-01-15",
  ...cambios,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hayQueAnonimizar", () => {
  it("solo producción recibe los datos reales", () => {
    expect(hayQueAnonimizar("production")).toBe(false);
  });

  it.each(["qa", "preview", "local", "", "Production", undefined])("%s se anonimiza", (ambiente) => {
    vi.stubEnv("APP_ENV", ambiente ?? "");
    expect(hayQueAnonimizar(ambiente)).toBe(true);
  });

  it("toma el ambiente del build", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(hayQueAnonimizar()).toBe(false);
    vi.stubEnv("APP_ENV", "qa");
    expect(hayQueAnonimizar()).toBe(true);
  });
});

describe("anonimizarClienta", () => {
  it("no deja ningún dato personal", () => {
    const texto = JSON.stringify(anonimizarClienta(clienta(), CLAVE));

    expect(texto).not.toContain("REAL");
    expect(texto).not.toContain("Real");
    expect(texto).not.toContain("real@");
    expect(texto).not.toContain("44445555");
  });

  it("deja lo que no identifica a nadie", () => {
    expect(anonimizarClienta(clienta(), CLAVE)).toMatchObject({
      id: 7,
      nombre: "Clienta 7",
      nombrePila: null,
      email: "clienta-7@anonimizada.invalid",
      provincia: "Buenos Aires",
      localidad: null,
      habilitada: true,
      creadaEl: "2026-01-15",
    });
  });

  it("el teléfono falso no puede sonarle a nadie, y se lee como cualquier otro", () => {
    const { telefono } = anonimizarClienta(clienta(), CLAVE);

    expect(telefono).toMatch(/^00\d{8}$/);
    expect(telefonoNormalizado(telefono)).toBe(telefono);
  });

  it("dos formatos del mismo número dan el mismo teléfono falso", () => {
    const uno = anonimizarClienta(clienta({ telefono: "+5491144445555" }), CLAVE);
    const otro = anonimizarClienta(clienta({ id: 8, telefono: "11-44445555" }), CLAVE);

    expect(uno.telefono).toBe(otro.telefono);
  });

  it("números distintos dan teléfonos distintos", () => {
    const uno = anonimizarClienta(clienta({ telefono: "1144445555" }), CLAVE);
    const otro = anonimizarClienta(clienta({ telefono: "1144445556" }), CLAVE);

    expect(uno.telefono).not.toBe(otro.telefono);
  });

  it("sin la clave no se puede reproducir: depende de ella", () => {
    expect(anonimizarClienta(clienta(), CLAVE).telefono).not.toBe(anonimizarClienta(clienta(), OTRA_CLAVE).telefono);
  });

  it("lo que no tenía sigue sin tenerlo, y un número que no se puede leer no queda", () => {
    expect(anonimizarClienta(clienta({ telefono: null, email: null }), CLAVE)).toMatchObject({
      telefono: null,
      email: null,
    });
    expect(anonimizarClienta(clienta({ telefono: "4444-555" }), CLAVE).telefono).toBeNull();
  });
});
