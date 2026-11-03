import { describe, expect, it } from "vitest";
import { aplicarFallo, clavesDeIntento, type EstadoIntentos, esperaLegible, ipDelCliente } from "./throttle";

const MINUTO = 60 * 1000;
const t0 = new Date("2026-11-03T13:00:00Z");
const despues = (minutos: number) => new Date(t0.getTime() + minutos * MINUTO);

function fallar(veces: number, limite = 5, desde: EstadoIntentos | null = null, cada = 1) {
  let estado = desde;
  for (let i = 0; i < veces; i++) estado = aplicarFallo(estado, limite, despues(i * cada));
  return estado!;
}

describe("límite de intentos", () => {
  it("cuatro fallos no bloquean; el quinto bloquea 15 minutos", () => {
    expect(fallar(4)).toMatchObject({ failures: 4, lockouts: 0, lockedUntil: null });
    const bloqueado = fallar(5);
    expect(bloqueado).toMatchObject({ failures: 0, lockouts: 1 });
    expect(bloqueado.lockedUntil).toEqual(despues(4 + 15));
  });

  it("los fallos separados por más de 15 minutos no se suman", () => {
    expect(fallar(10, 5, null, 16)).toMatchObject({ failures: 1, lockouts: 0 });
  });

  it("cada bloqueo seguido duplica la espera, hasta 24 horas", () => {
    let estado = fallar(5);
    const esperas: number[] = [];
    for (let vez = 0; vez < 8; vez++) {
      const desde = estado.lockedUntil!;
      for (let i = 0; i < 5; i++) estado = aplicarFallo(estado, 5, desde);
      esperas.push((estado.lockedUntil!.getTime() - desde.getTime()) / MINUTO);
    }
    expect(esperas).toEqual([30, 60, 120, 240, 480, 960, 1440, 1440]);
  });

  it("después de un día sin fallos, la espera vuelve a 15 minutos", () => {
    const reincidente = fallar(5, 5, fallar(5));
    expect(reincidente.lockouts).toBe(2);
    const otroDia = new Date(reincidente.updatedAt.getTime() + 25 * 60 * MINUTO);
    let estado: EstadoIntentos = reincidente;
    for (let i = 0; i < 5; i++) estado = aplicarFallo(estado, 5, otroDia);
    expect(estado.lockouts).toBe(1);
    expect(estado.lockedUntil).toEqual(new Date(otroDia.getTime() + 15 * MINUTO));
  });

  it("la IP tiene su propio límite, más alto", () => {
    expect(fallar(19, 20, null, 0).lockedUntil).toBeNull();
    expect(fallar(20, 20, null, 0).lockedUntil).not.toBeNull();
  });
});

describe("claves, IP y mensajes", () => {
  it("el usuario se normaliza para que Leo y leo cuenten juntos", () => {
    expect(clavesDeIntento(" Leo@VX3.com.ar ", "1.2.3.4")).toEqual({ user: "user:leo@vx3.com.ar", ip: "ip:1.2.3.4" });
  });

  it("toma la IP del cliente de x-forwarded-for", () => {
    expect(ipDelCliente(new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(ipDelCliente(new Headers({ "x-real-ip": "200.9.9.9" }))).toBe("200.9.9.9");
    expect(ipDelCliente(new Headers())).toBe("desconocida");
  });

  it("dice la espera en minutos u horas", () => {
    expect(esperaLegible(despues(15), t0)).toBe("15 minutos");
    expect(esperaLegible(new Date(t0.getTime() + 20_000), t0)).toBe("1 minuto");
    expect(esperaLegible(despues(60), t0)).toBe("1 hora");
    expect(esperaLegible(despues(121), t0)).toBe("3 horas");
  });
});
