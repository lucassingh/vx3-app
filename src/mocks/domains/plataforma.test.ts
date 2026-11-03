import { beforeEach, describe, expect, it } from "vitest";
import { describirValorRegla } from "@/lib/api/contracts/plataforma";
import type { ApiErrorBody, AuditoriaEntry, CambioRegla, ReglaNegocio } from "@/lib/api/types";
import { resetDb } from "../db";
import { handleMockRequest, MOCK_API_PREFIX } from "../router";

async function call<T>(path: string, init?: RequestInit) {
  const response = await handleMockRequest(new Request(`http://test.local${MOCK_API_PREFIX}${path}`, init));
  return { status: response.status, body: (await response.json()) as T };
}

const patch = (cambios: unknown) => ({ method: "PATCH", body: JSON.stringify({ cambios }) });

beforeEach(() => {
  resetDb();
});

describe("reglas de negocio", () => {
  it("rechaza un coeficiente menor a 1 y no toca la regla", async () => {
    const { status, body } = await call<ApiErrorBody>(
      "/plataforma/reglas",
      patch([{ id: "coef-media-docena", valor: 0.9 }]),
    );
    expect(status).toBe(422);
    expect(body.error.message).toMatch(/menor a 1/);

    const { body: reglas } = await call<ReglaNegocio[]>("/plataforma/reglas");
    expect(reglas.find((regla) => regla.id === "coef-media-docena")?.valor).toBe(1.3);
  });

  it("guarda el cambio con el antes y el después, en el historial y en la auditoría", async () => {
    const { status, body } = await call<{ cambios: CambioRegla[] }>(
      "/plataforma/reglas",
      patch([{ id: "minimo", valor: 50_000 }]),
    );
    expect(status).toBe(200);
    expect(body.cambios).toEqual([expect.objectContaining({ antes: "$ 45.000", despues: "$ 50.000" })]);

    const historial = await call<CambioRegla[]>("/plataforma/reglas/historial");
    expect(historial.body[0]).toMatchObject({ reglaId: "minimo", por: "Elías Llaury" });
    const auditoria = await call<AuditoriaEntry[]>("/plataforma/auditoria?usuario=u-elias");
    expect(auditoria.body[0]).toMatchObject({ categoria: "reglas", antes: "$ 45.000", despues: "$ 50.000" });
  });

  it("describe los valores igual en el servidor y en el navegador", () => {
    expect(describirValorRegla({ tipo: "coeficiente" }, 1.3)).toBe("× 1,30");
    expect(describirValorRegla({ tipo: "coeficiente" }, 1.1765)).toBe("× 1,1765");
    expect(describirValorRegla({ tipo: "numero", unidad: "horas" }, 24)).toBe("24 horas");
    expect(describirValorRegla({ tipo: "moneda" }, null)).toBe("Sin definir");
  });
});

describe("usuarios", () => {
  it("invita con un rol y no deja repetir el email", async () => {
    const init = { method: "POST", body: JSON.stringify({ email: "contador@estudio.com", rol: "solo_lectura" }) };
    expect((await call("/plataforma/usuarios/invitar", init)).status).toBe(200);
    expect((await call("/plataforma/usuarios/invitar", init)).status).toBe(409);
  });
});
