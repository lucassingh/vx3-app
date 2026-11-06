import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogoFacetas } from "@/lib/api/types";
import { CatalogoFiltros } from "./catalogo-filtros";

const navegacion = vi.hoisted(() => ({ query: "", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navegacion.replace }),
  usePathname: () => "/productos/catalogo",
  useSearchParams: () => new URLSearchParams(navegacion.query),
}));

const FACETAS: CatalogoFacetas = {
  rubros: [
    { valor: "less", etiqueta: "LESS", productos: 132 },
    { valor: "corpinos", etiqueta: "CORPIÑOS", productos: 113 },
  ],
  subrubros: [{ valor: "normal", etiqueta: "NORMAL", productos: 45 }],
  marcas: [],
  telas: [],
  talles: [],
  colores: [],
  proveedores: [],
};

const elegir = (filtro: string, opcion: string) =>
  userEvent.setup().selectOptions(screen.getByRole("combobox", { name: filtro }), opcion);

beforeEach(() => {
  navegacion.query = "";
  navegacion.replace.mockClear();
});

describe("CatalogoFiltros", () => {
  it("cada opción dice cuántos productos tiene", () => {
    render(<CatalogoFiltros facetas={FACETAS} />);

    expect(screen.getByRole("option", { name: "LESS (132)" })).toBeInTheDocument();
  });

  it("por defecto dice que no incluye los históricos", () => {
    render(<CatalogoFiltros facetas={FACETAS} />);

    expect(screen.getByRole("option", { name: "Activos y agotados" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Históricos" })).toBeInTheDocument();
  });

  it("un filtro nuevo vuelve a la primera página", async () => {
    navegacion.query = "page=3";
    render(<CatalogoFiltros facetas={FACETAS} />);

    await elegir("Rubro", "LESS (132)");

    expect(navegacion.replace).toHaveBeenCalledWith("/productos/catalogo?rubro=less", { scroll: false });
  });

  it("al cambiar de rubro se va el subrubro, que era del otro", async () => {
    navegacion.query = "rubro=less&subrubro=normal&marca=x";
    render(<CatalogoFiltros facetas={FACETAS} />);

    await elegir("Rubro", "CORPIÑOS (113)");

    expect(navegacion.replace).toHaveBeenCalledWith("/productos/catalogo?rubro=corpinos&marca=x", { scroll: false });
  });

  it("limpiar saca los filtros, pero deja la búsqueda y la vista", async () => {
    navegacion.query = "q=ln25&vista=lista&rubro=less&page=2";
    render(<CatalogoFiltros facetas={FACETAS} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(navegacion.replace).toHaveBeenCalledWith("/productos/catalogo?q=ln25&vista=lista", { scroll: false });
  });

  it("sin filtros no ofrece limpiar", () => {
    render(<CatalogoFiltros facetas={FACETAS} />);

    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
  });

  it("cambiar de vista no cambia de página", async () => {
    navegacion.query = "page=3";
    render(<CatalogoFiltros facetas={FACETAS} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Lista" }));

    expect(navegacion.replace).toHaveBeenCalledWith("/productos/catalogo?page=3&vista=lista", { scroll: false });
  });
});
