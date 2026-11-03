// @vitest-environment node
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, logger: createLogger(stream, "info") };
}

describe("logger", () => {
  it("escribe JSON con el nivel por nombre, la hora y los campos del contexto", () => {
    const { lines, logger } = capture();

    logger.child({ requestId: "r-1" }).info({ ms: 12 }, "acción completada");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "info", app: "vx3", requestId: "r-1", ms: 12, msg: "acción completada" });
    expect(lines[0]?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("oculta datos personales y secretos aunque se pasen por error", () => {
    const { lines, logger } = capture();

    logger.info(
      {
        email: "clienta@example.com",
        clienta: { telefono: "1155550000", nombre: "Ana" },
        headers: { authorization: "Bearer abc" },
        token: "abc",
      },
      "pedido",
    );

    expect(lines[0]).toMatchObject({
      email: "[oculto]",
      clienta: { telefono: "[oculto]", nombre: "Ana" },
      headers: { authorization: "[oculto]" },
      token: "[oculto]",
    });
  });

  it("respeta el nivel", () => {
    const { lines, logger } = capture();
    logger.debug("no sale");
    expect(lines).toHaveLength(0);
  });
});
