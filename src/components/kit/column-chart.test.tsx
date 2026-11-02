import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { niceMax } from "@/lib/chart";
import { ColumnChart, type ChartBar } from "./column-chart";

const bars: ChartBar[] = [
  { value: 4, valueLabel: "4 pedidos", label: "miércoles, 21 de octubre", axisLabel: "21 oct" },
  { value: 18, valueLabel: "18 pedidos", label: "Ayer", axisLabel: "22 oct" },
  { value: 16, valueLabel: "16 pedidos", label: "Hoy", axisLabel: "Hoy" },
];

const chart = <ColumnChart bars={bars} max={20} ticks={["20", "10", "0"]} description="Pedidos por día" />;

describe("ColumnChart", () => {
  it("entra al gráfico con Tab en el día de hoy y lo recorre con flechas", async () => {
    const user = userEvent.setup();
    render(chart);

    await user.tab();
    expect(screen.getByRole("button", { name: "Hoy: 16 pedidos" })).toHaveFocus();
    expect(screen.getByText("16 pedidos")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Ayer: 18 pedidos" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(
      screen.getByRole("button", { name: "miércoles, 21 de octubre: 4 pedidos" }),
    ).toHaveFocus();
  });

  it("deja una sola barra en el orden de tabulación", () => {
    render(chart);
    const tabbable = screen.getAllByRole("button").filter((bar) => bar.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });
});

describe("niceMax", () => {
  it("redondea el techo del eje a un valor par", () => {
    expect(niceMax(18)).toBe(20);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(1_340_000)).toBe(2_000_000);
  });
});
