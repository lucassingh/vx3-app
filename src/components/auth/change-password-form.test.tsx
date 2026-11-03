import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form";

const { changePassword, toast } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/platform/auth/actions", () => ({ changePassword }));
vi.mock("@/lib/toast", () => ({ toast }));

async function completar(onDone = vi.fn()) {
  const user = userEvent.setup();
  render(<ChangePasswordForm onDone={onDone} />);
  await user.type(screen.getByLabelText("Contraseña actual"), "k7Pm-x2Qa-r9Tz-w3Hb");
  await user.type(screen.getByLabelText("Contraseña nueva"), "mi frase de siempre");
  await user.type(screen.getByLabelText("Repetí la contraseña nueva"), "mi frase de siempre");
  await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
  return onDone;
}

beforeEach(() => {
  changePassword.mockReset();
});

describe("ChangePasswordForm", () => {
  it("guarda y avisa que se cerraron las otras sesiones", async () => {
    changePassword.mockResolvedValue({ ok: true, data: null });

    const onDone = await completar();

    expect(changePassword).toHaveBeenCalledWith({
      actual: "k7Pm-x2Qa-r9Tz-w3Hb",
      nueva: "mi frase de siempre",
      repetida: "mi frase de siempre",
    });
    expect(onDone).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Contraseña cambiada", {
      description: "Cerramos tus otras sesiones abiertas.",
    });
  });

  it("muestra el error de cada campo junto al campo y lleva el foco al primero", async () => {
    changePassword.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "La contraseña actual no es correcta.",
        fieldErrors: { actual: ["La contraseña actual no es correcta."] },
      },
    });

    const onDone = await completar();

    const actual = screen.getByLabelText("Contraseña actual");
    expect(actual).toHaveAttribute("aria-invalid", "true");
    expect(actual).toHaveAccessibleDescription("La contraseña actual no es correcta.");
    await vi.waitFor(() => expect(actual).toHaveFocus());
    expect(onDone).not.toHaveBeenCalled();
  });

  it("un error sin campo se muestra como alerta", async () => {
    changePassword.mockResolvedValue({ ok: false, error: { code: "UNAUTHENTICATED", message: "La sesión venció." } });

    await completar();

    expect(await screen.findByRole("alert")).toHaveTextContent("La sesión venció.");
  });
});
