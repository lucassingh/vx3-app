import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const { signIn, replace, toast } = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/platform/auth/actions", () => ({ signIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/toast", () => ({ toast }));

async function ingresar(identifier: string, password: string) {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText("Email o usuario"), identifier);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

beforeEach(() => {
  signIn.mockReset();
  replace.mockReset();
});

describe("LoginForm", () => {
  it("no trae credenciales precargadas", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email o usuario")).toHaveValue("");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });

  it("entra con el email o el usuario y va al inicio", async () => {
    signIn.mockResolvedValue({ ok: true, data: { name: "Leo Pérez", mustChangePassword: false } });

    await ingresar("leo", "una contraseña larga");

    expect(signIn).toHaveBeenCalledWith({ identifier: "leo", password: "una contraseña larga" });
    expect(replace).toHaveBeenCalledWith("/");
    expect(toast.success).toHaveBeenCalledWith("Sesión iniciada", { description: "Hola de nuevo, Leo." });
  });

  it("con una contraseña temporal lleva a cambiarla", async () => {
    signIn.mockResolvedValue({ ok: true, data: { name: "Leo Pérez", mustChangePassword: true } });

    await ingresar("leo", "k7Pm-x2Qa-r9Tz-w3Hb");

    expect(replace).toHaveBeenCalledWith("/cambiar-contrasena");
  });

  it("muestra el error y lo asocia a los campos", async () => {
    signIn.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "El email, el usuario o la contraseña no son correctos." },
    });

    await ingresar("leo", "mal");

    expect(await screen.findByRole("alert")).toHaveTextContent("no son correctos");
    expect(screen.getByLabelText("Email o usuario")).toHaveAttribute("aria-invalid", "true");
    expect(replace).not.toHaveBeenCalled();
  });
});
