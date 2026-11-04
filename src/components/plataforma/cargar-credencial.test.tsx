import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CargarCredencial } from "./cargar-credencial";

const { cargarCredencial, refresh, toast } = vi.hoisted(() => ({
  cargarCredencial: vi.fn(),
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/platform/credentials/actions", () => ({ cargarCredencial }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/toast", () => ({ toast }));

async function abrirYEscribir(valor: string, yaCargada = false) {
  const user = userEvent.setup();
  render(<CargarCredencial integracion="dux" nombre="DUX" yaCargada={yaCargada} />);
  await user.click(screen.getByRole("button", { name: yaCargada ? "Cambiar credencial" : "Cargar credencial" }));
  await screen.findByRole("dialog");
  await user.type(screen.getByLabelText("Token"), valor);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  return user;
}

beforeEach(() => {
  cargarCredencial.mockReset();
  refresh.mockReset();
  toast.success.mockReset();
});

describe("CargarCredencial", () => {
  it("el token se escribe en un campo oculto", async () => {
    const user = userEvent.setup();
    render(<CargarCredencial integracion="dux" nombre="DUX" yaCargada={false} />);
    await user.click(screen.getByRole("button", { name: "Cargar credencial" }));

    expect(await screen.findByLabelText("Token")).toHaveAttribute("type", "password");
  });

  it("guarda, avisa con la máscara y cierra sin mostrar el valor", async () => {
    cargarCredencial.mockResolvedValue({ ok: true, data: { mascara: "••••7c1e" } });
    await abrirYEscribir("token-de-prueba-7c1e");

    expect(cargarCredencial).toHaveBeenCalledWith({ integracion: "dux", valor: "token-de-prueba-7c1e" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Credencial de DUX guardada", { description: "Termina en ••••7c1e." });
    expect(refresh).toHaveBeenCalled();
  });

  it("si ya hay una, ofrece cambiarla", () => {
    render(<CargarCredencial integracion="dux" nombre="DUX" yaCargada />);

    expect(screen.getByRole("button", { name: "Cambiar credencial" })).toBeInTheDocument();
  });

  it("muestra el error del campo y deja el diálogo abierto", async () => {
    cargarCredencial.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos.", fieldErrors: { valor: ["Parece incompleta."] } },
    });
    await abrirYEscribir("corto");

    expect(await screen.findByText("Parece incompleta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Token")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("muestra un error general, como la clave maestra faltante", async () => {
    cargarCredencial.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "Falta la clave maestra (CREDENTIALS_KEY) en este ambiente." },
    });
    await abrirYEscribir("token-de-prueba-7c1e");

    expect(await screen.findByText(/Falta la clave maestra/)).toBeInTheDocument();
  });
});
