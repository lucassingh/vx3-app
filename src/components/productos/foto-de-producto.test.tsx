import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FotoDeProducto } from "./foto-de-producto";

const URL_DE_DRIVE = "https://drive.google.com/thumbnail?id=abc&sz=w400";
const URL_DEL_STORE = "https://abc.public.blob.vercel-storage.com/catalogo/top-x1.jpg";

describe("FotoDeProducto", () => {
  it("muestra la foto, sin mandarle la dirección de la app a Google", () => {
    render(<FotoDeProducto url={URL_DE_DRIVE} sku="LN25" colores={[]} />);

    const foto = screen.getByRole("img", { name: "Foto de LN25" });
    expect(foto).toHaveAttribute("src", URL_DE_DRIVE);
    expect(foto).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(foto).toHaveAttribute("loading", "lazy");
  });

  it("sin foto, queda la miniatura con el código", () => {
    render(<FotoDeProducto url={null} sku="LN25" colores={["NEGRO"]} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("LN25")).toBeInTheDocument();
  });

  it("una subida en la app pasa por el optimizador: puede pesar 10 MB", () => {
    render(<FotoDeProducto url={URL_DEL_STORE} sku="LN25" colores={[]} />);

    const foto = screen.getByRole("img", { name: "Foto de LN25" });
    expect(foto.getAttribute("src")).toContain(`/_next/image?url=${encodeURIComponent(URL_DEL_STORE)}`);
  });

  it("una subida en la app que no carga tampoco queda rota", () => {
    render(<FotoDeProducto url={URL_DEL_STORE} sku="LN25" colores={[]} tamano="sm" />);

    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("LN25")).toBeInTheDocument();
  });

  it("si la foto no carga, nunca queda una imagen rota", () => {
    render(<FotoDeProducto url={URL_DE_DRIVE} sku="LN25" colores={[]} />);

    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("LN25")).toBeInTheDocument();
  });
});
