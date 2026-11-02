import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import { Toaster } from "./toaster";

afterEach(() => {
  act(() => toast.dismiss());
});

describe("Toaster", () => {
  it("muestra el aviso con título y descripción", async () => {
    render(<Toaster />);

    act(() => {
      toast.success("Cambios guardados", { description: "Tus preferencias se actualizaron." });
    });

    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
    expect(screen.getByText("Tus preferencias se actualizaron.")).toBeInTheDocument();
  });

  it("ejecuta la acción del aviso", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<Toaster />);

    act(() => {
      toast.error("No se pudo guardar", { action: { label: "Reintentar", onClick: retry } });
    });

    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
