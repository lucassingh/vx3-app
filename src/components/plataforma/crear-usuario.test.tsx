import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrearUsuario } from "./crear-usuario";

const { crearUsuario, refresh, toast } = vi.hoisted(() => ({
  crearUsuario: vi.fn(),
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/platform/users/actions", () => ({ crearUsuario }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/toast", () => ({ toast }));

async function abrirYCompletar() {
  const user = userEvent.setup();
  render(<CrearUsuario />);
  await user.click(screen.getByRole("button", { name: "Crear usuario" }));
  const dialogo = await screen.findByRole("dialog");
  await user.type(screen.getByLabelText("Nombre y apellido"), "Leo Pérez");
  await user.type(screen.getByLabelText("Email"), "leo@vx3.com.ar");
  await user.type(screen.getByLabelText("Usuario (opcional)"), "leo");
  await user.selectOptions(screen.getByLabelText("Rol"), "postventa");
  return { user, dialogo };
}

beforeEach(() => {
  crearUsuario.mockReset();
  refresh.mockReset();
});

describe("CrearUsuario", () => {
  it("crea el usuario y muestra la contraseña temporal una sola vez", async () => {
    crearUsuario.mockResolvedValue({
      ok: true,
      data: { id: "u-1", nombre: "Leo Pérez", passwordTemporal: "k7Pm-x2Qa-r9Tz-w3Hb" },
    });
    const { user, dialogo } = await abrirYCompletar();

    expect(screen.getByText(/Reclamos, notas de crédito/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Crear usuario" }).at(-1)!);

    expect(crearUsuario).toHaveBeenCalledWith({
      nombre: "Leo Pérez",
      email: "leo@vx3.com.ar",
      usuario: "leo",
      rol: "postventa",
      puesto: "",
    });
    expect(await screen.findByLabelText("Contraseña temporal")).toHaveTextContent("k7Pm-x2Qa-r9Tz-w3Hb");
    expect(refresh).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Listo" }));
    expect(dialogo).not.toBeInTheDocument();
  });

  it("muestra el error junto al campo", async () => {
    crearUsuario.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos.", fieldErrors: { email: ["Revisá el email."] } },
    });
    const { user } = await abrirYCompletar();

    await user.click(screen.getAllByRole("button", { name: "Crear usuario" }).at(-1)!);

    expect(await screen.findByText("Revisá el email.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByLabelText("Contraseña temporal")).not.toBeInTheDocument();
  });

  it("un conflicto (email repetido) se muestra como alerta", async () => {
    crearUsuario.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Ya hay un usuario con ese email." },
    });
    const { user } = await abrirYCompletar();

    await user.click(screen.getAllByRole("button", { name: "Crear usuario" }).at(-1)!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya hay un usuario con ese email.");
  });
});
