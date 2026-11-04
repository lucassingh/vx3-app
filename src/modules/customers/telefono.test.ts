import { describe, expect, it } from "vitest";
import { telefonoNormalizado } from "./telefono";

describe("telefonoNormalizado", () => {
  it.each(["+5491144445555", "+541144445555", "5491144445555", "1144445555", "11-44445555", "+54 9 11 4444-5555"])(
    "%s es el mismo teléfono",
    (telefono) => {
      expect(telefonoNormalizado(telefono)).toBe("1144445555");
    },
  );

  it.each(["4444-555", "", "sin teléfono", null, undefined])("%s no identifica a nadie", (telefono) => {
    expect(telefonoNormalizado(telefono)).toBeNull();
  });
});
