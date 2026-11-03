// @vitest-environment node
import { describe, expect, it } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("genera un uuid versión 7", () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("ordena por fecha de creación y no se repite", () => {
    const ids = Array.from({ length: 200 }, () => newId());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});
