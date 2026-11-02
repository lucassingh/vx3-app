import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("es un botón primary por defecto", () => {
    render(<Button>Guardar</Button>);
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("con asChild aplica los estilos al hijo, por ejemplo un link", () => {
    render(
      <Button asChild variant="outline">
        <a href="https://nextjs.org/docs">Documentación</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Documentación" });
    expect(link).toHaveAttribute("href", "https://nextjs.org/docs");
    expect(link).toHaveClass("border-border-strong");
  });
});
