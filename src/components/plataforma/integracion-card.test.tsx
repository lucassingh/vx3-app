import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Integracion } from "@/lib/api/types";
import { IntegracionCard } from "./integracion-card";

const { probarIntegracion, probarSimulada, refresh, toast } = vi.hoisted(() => ({
  probarIntegracion: vi.fn(),
  probarSimulada: vi.fn(),
  refresh: vi.fn(),
  toast: { promise: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/platform/credentials/actions", () => ({ probarIntegracion, cargarCredencial: vi.fn() }));
vi.mock("@/lib/api/browser", () => ({ api: { plataforma: { integraciones: { probar: probarSimulada } } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/toast", () => ({ toast }));

const integracion = (id: string, nombre: string): Integracion => ({
  id,
  nombre,
  tipo: "ERP",
  estado: "ok",
  detalle: "Detalle",
  frecuencia: "Cada día",
  ultimoSync: null,
  metricas: [],
  credencial: null,
});

const LABELS = { ultimoSync: "Nunca", credencial: null };

function probar(item: Integracion) {
  render(<IntegracionCard integracion={item} labels={LABELS} />);
  return userEvent.setup().click(screen.getByRole("button", { name: "Probar conexión" }));
}

/** La promesa que recibió el toast: es la que dice si la prueba salió bien. */
async function promesaDelToast() {
  await waitFor(() => expect(toast.promise).toHaveBeenCalled());
  return toast.promise.mock.calls[0]![0] as Promise<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Como el toast real, ataja el rechazo de la promesa que recibe.
  toast.promise.mockImplementation((promesa: Promise<unknown>) => {
    promesa.catch(() => {});
    return { unwrap: () => Promise.resolve() };
  });
});

describe("IntegracionCard", () => {
  it("DUX se prueba de verdad, no contra la API simulada", async () => {
    probarIntegracion.mockResolvedValue({ ok: true, data: { ok: true, latenciaMs: 900, mensaje: "DUX respondió." } });

    await probar(integracion("dux", "DUX"));

    expect(await promesaDelToast()).toMatchObject({ mensaje: "DUX respondió." });
    expect(probarIntegracion).toHaveBeenCalledWith({ integracion: "dux" });
    expect(probarSimulada).not.toHaveBeenCalled();
  });

  it("si DUX no respondió bien, el aviso es de error y lleva el motivo", async () => {
    probarIntegracion.mockResolvedValue({
      ok: true,
      data: { ok: false, latenciaMs: 900, mensaje: "Todavía no se cargó el token de DUX." },
    });

    await probar(integracion("dux", "DUX"));

    await expect(promesaDelToast()).rejects.toThrow("Todavía no se cargó el token de DUX.");
  });

  it("lo que todavía no está conectado sigue con la API simulada, y sin botón de credencial", async () => {
    probarSimulada.mockResolvedValue({ ok: true, latenciaMs: 300, mensaje: "Meta respondió." });

    await probar(integracion("meta", "Meta Ads"));

    await expect(promesaDelToast()).resolves.toMatchObject({ mensaje: "Meta respondió." });
    expect(probarIntegracion).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cargar credencial" })).not.toBeInTheDocument();
  });

  it("DUX ofrece cargar la credencial", () => {
    render(<IntegracionCard integracion={integracion("dux", "DUX")} labels={LABELS} />);

    expect(screen.getByRole("button", { name: "Cargar credencial" })).toBeInTheDocument();
  });
});
