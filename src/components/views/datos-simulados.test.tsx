import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DatosSimulados } from "./datos-simulados";

describe("DatosSimulados", () => {
  it("dice que son datos de ejemplo y cuándo entran los reales", () => {
    render(<DatosSimulados pr="1.10" />);

    expect(screen.getByText("Datos de ejemplo · entra en la PR 1.10")).toBeInTheDocument();
  });
});
