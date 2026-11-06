import { upload } from "@vercel/blob/client";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FotoSubida } from "@/lib/api/types";
import { descartarFotosSubidas } from "@/modules/catalog/actions";
import { FOTO_MAX_BYTES, FOTOS_POR_PRODUCTO } from "@/modules/catalog/fotos";
import { AltaFotos } from "./alta-fotos";

vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
vi.mock("@/modules/catalog/actions", () => ({ descartarFotosSubidas: vi.fn(async () => ({ ok: true })) }));

const MEDIA = "https://abc.public.blob.vercel-storage.com";
const foto = (nombre: string): FotoSubida => ({ clave: `catalogo/${nombre}`, nombre, ancho: 800, alto: 800 });
const archivo = (nombre: string, type = "image/jpeg", bytes = 1000) => {
  const file = new File(["x"], nombre, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
};

function Prueba({ iniciales = [], puedeEditar = true }: { iniciales?: FotoSubida[]; puedeEditar?: boolean }) {
  const [fotos, setFotos] = useState(iniciales);
  return <AltaFotos fotos={fotos} mediaUrl={MEDIA} puedeEditar={puedeEditar} alCambiar={setFotos} />;
}

const elegir = (...archivos: File[]) =>
  fireEvent.change(screen.getByLabelText("Elegir fotos para subir"), { target: { files: archivos } });
const imagenes = () => screen.getAllByRole("img").map((imagen) => imagen.getAttribute("alt"));

beforeEach(() => {
  vi.mocked(upload).mockReset();
  vi.mocked(descartarFotosSubidas).mockClear();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1200, height: 900, close: () => {} })),
  );
});

describe("subir", () => {
  it("sube directo al store, con el permiso de la app, y guarda la clave y las medidas", async () => {
    vi.mocked(upload).mockResolvedValue({ pathname: "catalogo/top-abc123.jpg" } as never);

    render(<Prueba />);
    elegir(archivo("Top Negro.JPG"));

    expect(await screen.findByRole("img", { name: "Foto 1: Top Negro.JPG" })).toHaveAttribute(
      "src",
      `${MEDIA}/catalogo/top-abc123.jpg`,
    );
    expect(upload).toHaveBeenCalledWith(
      "catalogo/top-negro.jpg",
      expect.any(File),
      expect.objectContaining({
        access: "public",
        handleUploadUrl: "/api/v1/catalogo/alta/fotos",
        contentType: "image/jpeg",
      }),
    );
  });

  it("varias a la vez quedan en el orden en que se eligieron", async () => {
    vi.mocked(upload).mockImplementation(async (pathname) => ({ pathname }) as never);

    render(<Prueba />);
    elegir(archivo("uno.jpg"), archivo("dos.jpg"), archivo("tres.jpg"));

    await screen.findByRole("img", { name: "Foto 3: tres.jpg" });
    expect(imagenes()).toEqual(["Foto 1: uno.jpg", "Foto 2: dos.jpg", "Foto 3: tres.jpg"]);
  });

  it.each([
    ["foto.heic", "image/heic", 1000, "Tiene que ser JPG, PNG o WebP"],
    ["manual.pdf", "application/pdf", 1000, "Tiene que ser JPG, PNG o WebP"],
    ["enorme.jpg", "image/jpeg", FOTO_MAX_BYTES + 1, "Pesa más de 10 MB"],
  ])("%s se rechaza sin llegar a subir, y dice por qué", async (nombre, type, bytes, motivo) => {
    render(<Prueba />);
    elegir(archivo(nombre, type, bytes));

    expect(await screen.findByRole("alert")).toHaveTextContent(`${nombre}: ${motivo}`);
    expect(upload).not.toHaveBeenCalled();
  });

  it("un archivo que no se puede abrir no se sube", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("no es una imagen");
      }),
    );

    render(<Prueba />);
    elegir(archivo("roto.jpg"));

    expect(await screen.findByRole("alert")).toHaveTextContent("roto.jpg: No se pudo abrir");
    expect(upload).not.toHaveBeenCalled();
  });

  it("si falla la subida, lo dice, y las demás siguen", async () => {
    vi.mocked(upload)
      .mockRejectedValueOnce(new Error("sin permiso"))
      .mockResolvedValueOnce({ pathname: "catalogo/dos.jpg" } as never);

    render(<Prueba />);
    elegir(archivo("uno.jpg"), archivo("dos.jpg"));

    expect(await screen.findByRole("alert")).toHaveTextContent("uno.jpg: No se pudo subir");
    expect(await screen.findByRole("img", { name: "Foto 1: dos.jpg" })).toBeInTheDocument();
  });

  it("no pasa del máximo por producto", async () => {
    vi.mocked(upload).mockImplementation(async (pathname) => ({ pathname }) as never);
    const casi = Array.from({ length: FOTOS_POR_PRODUCTO - 1 }, (_, i) => foto(`f${i}.jpg`));

    render(<Prueba iniciales={casi} />);
    elegir(archivo("ultima.jpg"), archivo("de-mas.jpg"));

    expect(await screen.findByRole("alert")).toHaveTextContent("de-mas.jpg: Ya hay 10");
    await screen.findByRole("img", { name: "Foto 10: ultima.jpg" });
    expect(upload).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Elegir fotos para subir")).toBeNull();
  });
});

describe("el orden", () => {
  const TRES = [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")];
  const fila = (nombre: string) => screen.getByRole("img", { name: new RegExp(`${nombre}$`) }).closest("li")!;

  it("la primera es la principal", () => {
    render(<Prueba iniciales={TRES} />);

    expect(within(fila("a.jpg")).getByText("Principal")).toBeInTheDocument();
    expect(within(fila("b.jpg")).queryByText("Principal")).toBeNull();
    expect(screen.getByRole("button", { name: "Hacer principal a.jpg" })).toBeDisabled();
  });

  it("hacer principal la lleva adelante", () => {
    render(<Prueba iniciales={TRES} />);

    fireEvent.click(screen.getByRole("button", { name: "Hacer principal c.jpg" }));

    expect(imagenes()).toEqual(["Foto 1: c.jpg", "Foto 2: a.jpg", "Foto 3: b.jpg"]);
    expect(within(fila("c.jpg")).getByText("Principal")).toBeInTheDocument();
  });

  it("se mueve de a una, y en los extremos no se puede", () => {
    render(<Prueba iniciales={TRES} />);

    fireEvent.click(screen.getByRole("button", { name: "Mover después a.jpg" }));
    expect(imagenes()).toEqual(["Foto 1: b.jpg", "Foto 2: a.jpg", "Foto 3: c.jpg"]);

    fireEvent.click(screen.getByRole("button", { name: "Mover antes c.jpg" }));
    expect(imagenes()).toEqual(["Foto 1: b.jpg", "Foto 2: c.jpg", "Foto 3: a.jpg"]);

    expect(screen.getByRole("button", { name: "Mover antes b.jpg" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover después a.jpg" })).toBeDisabled();
  });

  it("al quitar la principal, la siguiente pasa a serlo, y avisa para limpiar el store", async () => {
    render(<Prueba iniciales={TRES} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar a.jpg" }));

    expect(imagenes()).toEqual(["Foto 1: b.jpg", "Foto 2: c.jpg"]);
    expect(within(fila("b.jpg")).getByText("Principal")).toBeInTheDocument();
    await waitFor(() => expect(descartarFotosSubidas).toHaveBeenCalledWith({ claves: ["catalogo/a.jpg"] }));
  });
});

describe("sin poder cargar", () => {
  it("un rol que solo ve las fotos no las puede subir ni cambiar", () => {
    render(<Prueba iniciales={[foto("a.jpg")]} puedeEditar={false} />);

    expect(screen.getByRole("img", { name: "Foto 1: a.jpg" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Elegir fotos para subir")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("un ambiente sin store lo dice, en vez de fallar al subir", () => {
    render(<AltaFotos fotos={[]} mediaUrl={null} puedeEditar alCambiar={() => {}} />);

    expect(screen.getByText("Este ambiente todavía no tiene dónde guardar fotos.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Elegir fotos para subir")).toBeNull();
  });
});
