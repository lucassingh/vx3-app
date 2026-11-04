import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Integracion } from "@/lib/api/types";
import { IntegracionCard } from "./integracion-card";

const { probarIntegracion, sincronizarIntegracion, refresh, toast } = vi.hoisted(() => ({
  probarIntegracion: vi.fn(),
  sincronizarIntegracion: vi.fn(),
  refresh: vi.fn(),
  toast: { promise: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/platform/credentials/actions", () => ({
  probarIntegracion,
  sincronizarIntegracion,
  cargarCredencial: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/toast", () => ({ toast }));

const CREDENCIAL = { mascara: "••••7c1e", cargadaPor: "Lucas", cargadaEn: "2026-11-04T12:00:00.000Z" };

const integracion = (id: string, nombre: string, cambios: Partial<Integracion> = {}): Integracion => ({
  id,
  nombre,
  tipo: "ERP",
  estado: "ok",
  detalle: "Detalle",
  frecuencia: "Cada día",
  ultimoSync: null,
  metricas: [],
  credencial: null,
  ...cambios,
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
  it("DUX se prueba de verdad", async () => {
    probarIntegracion.mockResolvedValue({ ok: true, data: { ok: true, latenciaMs: 900, mensaje: "DUX respondió." } });

    await probar(integracion("dux", "DUX"));

    expect(await promesaDelToast()).toMatchObject({ mensaje: "DUX respondió." });
    expect(probarIntegracion).toHaveBeenCalledWith({ integracion: "dux" });
  });

  it("si DUX no respondió bien, el aviso es de error y lleva el motivo", async () => {
    probarIntegracion.mockResolvedValue({
      ok: true,
      data: { ok: false, latenciaMs: 900, mensaje: "Todavía no se cargó el token de DUX." },
    });

    await probar(integracion("dux", "DUX"));

    await expect(promesaDelToast()).rejects.toThrow("Todavía no se cargó el token de DUX.");
  });

  it("lo que todavía no está conectado solo dice cuándo entra: nada para hacer ni datos que mostrar", () => {
    const meta = integracion("meta", "Meta Ads", {
      estado: "pendiente",
      detalle: "Se conecta en la PR 1.6.",
    });

    render(<IntegracionCard integracion={meta} labels={LABELS} />);

    expect(screen.getByText("Se conecta en la PR 1.6.")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Último sync")).not.toBeInTheDocument();
  });

  it("sin credencial cargada dice que falta, y no deja sincronizar", () => {
    render(<IntegracionCard integracion={integracion("dux", "DUX", { estado: "pendiente" })} labels={LABELS} />);

    expect(screen.getByText("Falta cargarla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sincronizar ahora" })).toBeDisabled();
  });

  it("muestra la máscara de la credencial cargada y quién la cargó", () => {
    const labels = { ultimoSync: "Hace 1 hora", credencial: "Lucas · hace 2 días" };

    render(<IntegracionCard integracion={integracion("dux", "DUX", { credencial: CREDENCIAL })} labels={labels} />);

    expect(screen.getByText("••••7c1e")).toBeInTheDocument();
    expect(screen.getByText("Lucas · hace 2 días")).toBeInTheDocument();
    expect(screen.getByText("Hace 1 hora")).toBeInTheDocument();
  });

  it("DUX ofrece cargar la credencial", () => {
    render(<IntegracionCard integracion={integracion("dux", "DUX")} labels={LABELS} />);

    expect(screen.getByRole("button", { name: "Cargar credencial" })).toBeInTheDocument();
  });
});

describe("Sincronizar ahora", () => {
  const apretar = () => {
    render(<IntegracionCard integracion={integracion("dux", "DUX", { credencial: CREDENCIAL })} labels={LABELS} />);
    return userEvent.setup().click(screen.getByRole("button", { name: "Sincronizar ahora" }));
  };

  it("solo lo tiene lo que ya está conectado", () => {
    render(<IntegracionCard integracion={integracion("meta", "Meta")} labels={LABELS} />);

    expect(screen.queryByRole("button", { name: "Sincronizar ahora" })).toBeNull();
  });

  it("la lanza, lo confirma y refresca", async () => {
    sincronizarIntegracion.mockResolvedValue({ ok: true, data: { runId: "wrun_01" } });

    await apretar();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("DUX se está sincronizando", expect.anything()));
    expect(sincronizarIntegracion).toHaveBeenCalledWith({ integracion: "dux" });
    expect(refresh).toHaveBeenCalled();
  });

  it.each(["degradado", "caido"] as const)("si está %s, el botón ofrece reintentar y hace lo mismo", async (estado) => {
    sincronizarIntegracion.mockResolvedValue({ ok: true, data: { runId: "wrun_01" } });
    const dux = integracion("dux", "DUX", { estado, credencial: CREDENCIAL });

    render(<IntegracionCard integracion={dux} labels={LABELS} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(sincronizarIntegracion).toHaveBeenCalledWith({ integracion: "dux" }));
    expect(screen.queryByRole("button", { name: "Sincronizar ahora" })).toBeNull();
  });

  it("con una corrida en curso, avisa", async () => {
    const message = "Ya hay una sincronización en curso: esperá a que termine.";
    sincronizarIntegracion.mockResolvedValue({ ok: false, error: { code: "CONFLICT", message } });

    await apretar();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo sincronizar DUX", { description: message }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
