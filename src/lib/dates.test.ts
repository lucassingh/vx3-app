// @vitest-environment node
import { describe, expect, it } from "vitest";
import { businessTime } from "./dates";

const at = (iso: string) => new Date(iso);

describe("businessTime", () => {
  it("el día cambia a la medianoche de Buenos Aires, no a la de UTC", () => {
    // 23:59 del lunes 2 acá = 02:59 del martes 3 en UTC.
    expect(businessTime.today(at("2026-11-03T02:59:00Z"))).toBe("2026-11-02");
    expect(businessTime.today(at("2026-11-03T03:00:00Z"))).toBe("2026-11-03");
    // Fin de mes y de año.
    expect(businessTime.today(at("2027-01-01T02:00:00Z"))).toBe("2026-12-31");
  });

  it("devuelve el reloj local con el día de la semana", () => {
    expect(businessTime.clock(at("2026-11-03T02:59:00Z"))).toEqual({
      date: "2026-11-02",
      year: 2026,
      month: 11,
      day: 2,
      hour: 23,
      minute: 59,
      weekday: 1,
    });
    expect(businessTime.clock(at("2026-11-02T03:00:00Z")).hour).toBe(0);
  });

  it("RN-80: el corte de las 11:00 es hora de acá", () => {
    expect(businessTime.isBefore("11:00", at("2026-11-02T13:59:00Z"))).toBe(true);
    expect(businessTime.isBefore("11:00", at("2026-11-02T14:00:00Z"))).toBe(false);
    expect(businessTime.isBefore("17:30", at("2026-11-02T20:29:00Z"))).toBe(true);
    expect(() => businessTime.isBefore("11", at("2026-11-02T14:00:00Z"))).toThrow(RangeError);
    expect(() => businessTime.isBefore("24:00")).toThrow(RangeError);
  });

  it("el día empieza a las 03:00 UTC (Argentina no tiene horario de verano)", () => {
    expect(businessTime.startOfDay("2026-11-02").toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(businessTime.startOfDay("2026-01-15").toISOString()).toBe("2026-01-15T03:00:00.000Z");
    expect(() => businessTime.startOfDay("2/11/2026")).toThrow(RangeError);
  });

  it("suma días cruzando fin de mes y de año", () => {
    expect(businessTime.addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(businessTime.addDays("2026-11-02", -7)).toBe("2026-10-26");
    expect(businessTime.addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(businessTime.addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("encuentra el inicio de la semana, arranque el lunes o el sábado", () => {
    // Corte con la mensajería: de lunes a sábado desde el 26/10.
    expect(businessTime.startOfWeek("2026-11-02", 1)).toBe("2026-11-02");
    expect(businessTime.startOfWeek("2026-11-07", 1)).toBe("2026-11-02");
    expect(businessTime.startOfWeek("2026-11-08", 1)).toBe("2026-11-02");
    // Antes era de sábado a sábado.
    expect(businessTime.startOfWeek("2026-11-02", 6)).toBe("2026-10-31");
    expect(businessTime.startOfWeek("2026-10-31", 6)).toBe("2026-10-31");
  });
});
