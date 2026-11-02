import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSkeleton, TableSkeleton } from "./skeletons";

describe("skeletons", () => {
  it("TableSkeleton muestra los encabezados reales y las filas pedidas", () => {
    const { container } = render(
      <TableSkeleton columns={["Nombre", "Estado", ""]} rows={3} />,
    );

    expect(screen.getByText("Nombre", { selector: "th" })).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    // Es decorativo: los lectores de pantalla no lo recorren.
    expect(container.querySelector("table")).toHaveAttribute("aria-hidden", "true");
  });

  it("PageSkeleton anuncia la carga a lectores de pantalla", () => {
    render(<PageSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando pantalla…");
  });
});
