// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientEnv, serverEnv } from "./env";

const POOLER = "postgresql://user:pass@ep-jolly-sky-b66v587n-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require";
const DIRECTA = "postgresql://user:pass@ep-jolly-sky-b66v587n.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require";
const SECRETO = "x".repeat(32);

const desarrollo = { NODE_ENV: "development", DATABASE_URL: POOLER, DATABASE_URL_UNPOOLED: DIRECTA };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("serverEnv", () => {
  it("acepta una configuración de desarrollo completa y aplica los valores por defecto", () => {
    const env = serverEnv(desarrollo);
    expect(env.DATABASE_URL).toBe(POOLER);
    expect(env.MOCK_API_DELAY_MS).toBe(350);
    expect(env.MOCK_API_FAILURE_RATE).toBe(0);
    expect(env.AUTH_SECRET).toBeUndefined();
  });

  it("en desarrollo exige las dos conexiones a Neon y dice cuál falta", () => {
    expect(() => serverEnv({ NODE_ENV: "development", DATABASE_URL: POOLER })).toThrow(
      /DATABASE_URL_UNPOOLED: falta, y es obligatoria en desarrollo/,
    );
  });

  it("detecta las conexiones cambiadas de lugar (con y sin pooler)", () => {
    expect(() => serverEnv({ ...desarrollo, DATABASE_URL: DIRECTA })).toThrow(/DATABASE_URL: .*con pooler/);
    expect(() => serverEnv({ ...desarrollo, DATABASE_URL_UNPOOLED: POOLER })).toThrow(
      /DATABASE_URL_UNPOOLED: .*conexión directa/,
    );
  });

  it("rechaza algo que no es una conexión de Postgres", () => {
    expect(() => serverEnv({ ...desarrollo, DATABASE_URL: "https://neon.tech" })).toThrow(/conexión de Postgres/);
  });

  it("al arrancar en producción exige AUTH_SECRET, y de al menos 32 caracteres", () => {
    const produccion = { ...desarrollo, NODE_ENV: "production" };
    expect(() => serverEnv(produccion)).toThrow(/AUTH_SECRET: falta, y es obligatoria en produccion/);
    expect(() => serverEnv({ ...produccion, AUTH_SECRET: "corto" })).toThrow(/al menos 32 caracteres/);
    expect(serverEnv({ ...produccion, AUTH_SECRET: SECRETO }).AUTH_SECRET).toBe(SECRETO);
  });

  it("durante next build, en los tests o con SKIP_ENV_VALIDATION no exige nada, pero sigue validando el formato", () => {
    expect(() => serverEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(() => serverEnv({ NODE_ENV: "test" })).not.toThrow();
    expect(() => serverEnv({ NODE_ENV: "production", SKIP_ENV_VALIDATION: "1" })).not.toThrow();
    expect(() => serverEnv({ NODE_ENV: "test", DATABASE_URL: DIRECTA })).toThrow(/con pooler/);
  });

  it("toma una variable vacía (CLAVE=) como no cargada", () => {
    expect(serverEnv({ ...desarrollo, AUTH_SECRET: "", DUX_TOKEN: "" }).DUX_TOKEN).toBeUndefined();
  });

  it("convierte los IDs de DUX a número y rechaza los que no lo son", () => {
    expect(serverEnv({ ...desarrollo, DUX_ID_EMPRESA: "9432" }).DUX_ID_EMPRESA).toBe(9432);
    expect(() => serverEnv({ ...desarrollo, DUX_ID_EMPRESA: "abc" })).toThrow(/DUX_ID_EMPRESA: .*entero positivo/);
  });

  it("valida la probabilidad de falla del mock", () => {
    expect(() => serverEnv({ ...desarrollo, MOCK_API_FAILURE_RATE: "2" })).toThrow(/va de 0 a 1/);
  });

  it("junta todos los problemas en un solo error, con dónde mirar", () => {
    expect(() => serverEnv({ NODE_ENV: "development", DUX_API_URL: "no-es-url" })).toThrow(
      /DUX_API_URL[\s\S]*DATABASE_URL[\s\S]*\.env\.example/,
    );
  });
});

describe("clientEnv", () => {
  it("deja el mock prendido salvo que diga false", () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "");
    expect(clientEnv().NEXT_PUBLIC_API_MOCK).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "false");
    expect(clientEnv().NEXT_PUBLIC_API_MOCK).toBe(false);
  });

  it("rechaza un valor que no es true ni false", () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCK", "si");
    expect(() => clientEnv()).toThrow(/NEXT_PUBLIC_API_MOCK: tiene que ser true o false/);
  });
});
