import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmarHistoricos, DecidirFoto, DeshacerDecision, NoEsHistorico } from "./revision-acciones";

const { acciones, refresh, toast } = vi.hoisted(() => ({
  acciones: {
    confirmarHistoricos: vi.fn(),
    decidirFotoSuelta: vi.fn(),
    deshacerDecisionDelCatalogo: vi.fn(),
    noEsHistorico: vi.fn(),
  },
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/catalog/actions", () => acciones);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/toast", () => ({ toast }));

const BIEN = { ok: true, data: { aplicada: true } };

beforeEach(() => {
  vi.clearAllMocks();
  for (const accion of Object.values(acciones)) accion.mockResolvedValue(BIEN);
});

describe("DecidirFoto", () => {
  const foto = () => render(<DecidirFoto driveId="abc" nombre="CJSTN60.jpg" sugerencias={["CJATN60"]} />);

  it("una sugerencia se aplica con un clic", async () => {
    foto();

    await userEvent.setup().click(screen.getByRole("button", { name: "Es de CJATN60" }));

    await waitFor(() =>
      expect(acciones.decidirFotoSuelta).toHaveBeenCalledWith({ driveId: "abc", producto: "CJATN60" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("CJSTN60.jpg va en CJATN60", undefined));
    expect(refresh).toHaveBeenCalled();
  });

  it("se puede escribir otro código", async () => {
    foto();
    const usuario = userEvent.setup();

    expect(screen.getByRole("button", { name: "Asignar" })).toBeDisabled();
    await usuario.type(screen.getByRole("textbox", { name: /CJSTN60\.jpg/ }), "ln25");
    await usuario.click(screen.getByRole("button", { name: "Asignar" }));

    await waitFor(() => expect(acciones.decidirFotoSuelta).toHaveBeenCalledWith({ driveId: "abc", producto: "ln25" }));
  });

  it("se puede descartar", async () => {
    foto();

    await userEvent.setup().click(screen.getByRole("button", { name: "Descartar" }));

    await waitFor(() => expect(acciones.decidirFotoSuelta).toHaveBeenCalledWith({ driveId: "abc", producto: null }));
  });

  it("si el código no existe, dice por qué y no refresca", async () => {
    acciones.decidirFotoSuelta.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "No existe el producto X." },
    });
    foto();

    await userEvent.setup().click(screen.getByRole("button", { name: "Es de CJATN60" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo guardar", { description: "No existe el producto X." }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("con una importación en curso, avisa que se aplica después", async () => {
    acciones.decidirFotoSuelta.mockResolvedValue({ ok: true, data: { aplicada: false } });
    foto();

    await userEvent.setup().click(screen.getByRole("button", { name: "Descartar" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.anything(), {
        description: "Hay una importación en curso: se aplica cuando termine.",
      }),
    );
  });
});

describe("los históricos", () => {
  it("la excepción dice de qué producto es", async () => {
    render(<NoEsHistorico sku="HIST1" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "No es histórico: HIST1" }));

    await waitFor(() => expect(acciones.noEsHistorico).toHaveBeenCalledWith({ producto: "HIST1" }));
  });

  it("confirmar en bloque pregunta antes, y aclara que nunca se borran", async () => {
    render(<ConfirmarHistoricos cantidad={357} />);
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Confirmar los 357" }));

    expect(acciones.confirmarHistoricos).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Confirmar 357 históricos" })).toBeInTheDocument();
    expect(screen.getByText(/Nunca se borran/)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(acciones.confirmarHistoricos).toHaveBeenCalledWith({}));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Quedaron confirmados 357 históricos", undefined));
  });

  it("cancelar no confirma nada", async () => {
    render(<ConfirmarHistoricos cantidad={2} />);
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: "Confirmar los 2" }));
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(acciones.confirmarHistoricos).not.toHaveBeenCalled();
  });
});

describe("DeshacerDecision", () => {
  it("deshace por su llave natural", async () => {
    render(<DeshacerDecision tipo="foto" clave="abc" descripcion="X va en LN1" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Deshacer: X va en LN1" }));

    await waitFor(() =>
      expect(acciones.deshacerDecisionDelCatalogo).toHaveBeenCalledWith({ tipo: "foto", clave: "abc" }),
    );
  });
});
