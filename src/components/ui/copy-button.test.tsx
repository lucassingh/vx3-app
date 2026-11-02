import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/toast", () => ({ toast }));

describe("CopyButton", () => {
  it("copia el valor al portapapeles y lo confirma", async () => {
    // userEvent.setup() reemplaza el portapapeles por uno en memoria.
    const user = userEvent.setup();
    render(<CopyButton value="src/app/page.tsx" label="Copiar ruta" successMessage="Ruta copiada" />);

    await user.click(screen.getByRole("button", { name: "Copiar ruta" }));

    expect(await navigator.clipboard.readText()).toBe("src/app/page.tsx");
    expect(toast.success).toHaveBeenCalledWith("Ruta copiada", { description: "src/app/page.tsx" });
  });
});
