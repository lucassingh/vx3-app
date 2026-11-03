// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "./client";
import { newId } from "./ids";

const db = getDb();

afterAll(async () => {
  await db.$disconnect();
});

describe("base de datos (Neon + Prisma)", () => {
  it("guarda y lee un registro por la conexión del pooler", async () => {
    const id = newId();
    await db.auditLog.create({
      data: { id, actorLabel: "test", action: "test.connection", entityType: "test", after: { ok: true } },
    });

    const leido = await db.auditLog.findUnique({ where: { id } });
    expect(leido).toMatchObject({ id, action: "test.connection", after: { ok: true } });
    expect(leido?.occurredAt).toBeInstanceOf(Date);

    await db.auditLog.delete({ where: { id } });
  });
});
