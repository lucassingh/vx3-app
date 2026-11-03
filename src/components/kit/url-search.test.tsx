import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UrlSearch } from "./url-search";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/pedidos/bandeja",
  useSearchParams: () => new URLSearchParams("q=romina&page=3"),
}));

beforeEach(() => {
  replace.mockClear();
});

describe("UrlSearch", () => {
  it("arranca con el valor de ?q=", () => {
    render(<UrlSearch label="Buscar pedidos" />);
    expect(screen.getByRole("searchbox", { name: "Buscar pedidos" })).toHaveValue("romina");
  });

  it("actualiza la URL una sola vez al dejar de escribir y vuelve a la página 1", async () => {
    const user = userEvent.setup();
    render(<UrlSearch label="Buscar pedidos" debounceMs={400} />);
    const input = screen.getByRole("searchbox", { name: "Buscar pedidos" });

    await user.clear(input);
    await user.type(input, "V-1043");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pedidos/bandeja?q=V-1043", { scroll: false }), {
      timeout: 2000,
    });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("al vaciar el campo quita el filtro", async () => {
    const user = userEvent.setup();
    render(<UrlSearch label="Buscar pedidos" debounceMs={50} />);

    await user.clear(screen.getByRole("searchbox", { name: "Buscar pedidos" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pedidos/bandeja", { scroll: false }));
  });
});
