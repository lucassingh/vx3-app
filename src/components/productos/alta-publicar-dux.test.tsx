import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogoBorrador, CatalogoPasoDeDux } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import {
  avanzarPublicacionEnDux,
  bajarArchivoDeImportacion,
  comprobarImportacionEnDux,
} from "@/modules/catalog/actions";
import { AltaPublicarEnDux } from "./alta-publicar-dux";

vi.mock("@/modules/catalog/actions", () => ({
  avanzarPublicacionEnDux: vi.fn(),
  comprobarImportacionEnDux: vi.fn(),
  bajarArchivoDeImportacion: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const paso = (codigo: string, estado: CatalogoPasoDeDux["estado"], detalle: string | null = null) => ({
  codigo,
  nombre: codigo,
  estado,
  detalle,
});

const borrador = (pasos: CatalogoPasoDeDux[], enDux = false) =>
  ({ id: "b1", publicacion: { pasos, enDux } }) as unknown as CatalogoBorrador;
const responde = (dato: CatalogoBorrador) => ({ ok: true as const, data: dato });

const PUEDE = { puede: true, motivo: null };

function Prueba({
  inicial = null,
  escritura = PUEDE,
  guardarAntes = vi.fn(async () => "b1"),
  borradorId = "b1",
}: {
  inicial?: CatalogoBorrador["publicacion"];
  escritura?: { puede: boolean; motivo: string | null };
  guardarAntes?: () => Promise<string | null>;
  borradorId?: string | null;
}) {
  const [publicacion, setPublicacion] = useState(inicial);
  return (
    <AltaPublicarEnDux
      borradorId={borradorId}
      publicacion={publicacion}
      escritura={escritura}
      guardarAntes={guardarAntes}
      alActualizar={(actualizado) => setPublicacion(actualizado.publicacion)}
    />
  );
}

beforeEach(() => {
  vi.mocked(avanzarPublicacionEnDux).mockReset();
  vi.mocked(comprobarImportacionEnDux).mockReset();
  vi.mocked(bajarArchivoDeImportacion).mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("publicar", () => {
  it("avanza de a un código hasta que queda en DUX", async () => {
    vi.mocked(avanzarPublicacionEnDux)
      .mockResolvedValueOnce(responde(borrador([paso("LN1", "creado"), paso("LN1-6", "pendiente")])))
      .mockResolvedValueOnce(responde(borrador([paso("LN1", "creado"), paso("LN1-6", "creado")], true)));

    render(<Prueba />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar en DUX" }));

    expect(await screen.findByText("Está en DUX.")).toBeInTheDocument();
    expect(avanzarPublicacionEnDux).toHaveBeenCalledTimes(2);
    expect(avanzarPublicacionEnDux).toHaveBeenCalledWith({ id: "b1" });
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("si no pasa la validación, no llega a DUX", async () => {
    render(<Prueba guardarAntes={vi.fn(async () => null)} />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar en DUX" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Publicar en DUX" })).toBeEnabled());
    expect(avanzarPublicacionEnDux).not.toHaveBeenCalled();
  });

  it("frena en el primer error, lo muestra, y se puede retomar", async () => {
    vi.mocked(avanzarPublicacionEnDux).mockResolvedValueOnce(
      responde(borrador([paso("LN1", "error", "DUX no confirmó el cambio.")])),
    );

    render(<Prueba />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar en DUX" }));

    expect(await screen.findByText("DUX no confirmó el cambio.")).toBeInTheDocument();
    expect(avanzarPublicacionEnDux).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("DUX no aceptó LN1", { description: "DUX no confirmó el cambio." });
    expect(await screen.findByRole("button", { name: "Retomar en DUX" })).toBeEnabled();
  });

  it("si la acción falla, lo dice y no sigue", async () => {
    vi.mocked(avanzarPublicacionEnDux).mockResolvedValueOnce({
      ok: false,
      error: { code: "CONFLICT", message: "Este producto ya se está publicando." },
    });

    render(<Prueba />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar en DUX" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo publicar", {
        description: "Este producto ya se está publicando.",
      }),
    );
    expect(avanzarPublicacionEnDux).toHaveBeenCalledOnce();
  });

  it("nunca da vueltas sin fin, aunque DUX nunca termine", async () => {
    vi.mocked(avanzarPublicacionEnDux).mockResolvedValue(responde(borrador([paso("LN1", "pendiente")])));

    render(<Prueba />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar en DUX" }));

    await screen.findByRole("button", { name: "Retomar en DUX" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Retomar en DUX" })).toBeEnabled());
    expect(vi.mocked(avanzarPublicacionEnDux).mock.calls.length).toBeLessThanOrEqual(12);
  });
});

describe("el ambiente", () => {
  const FRENADO = { puede: false, motivo: "Fuera de producción no se escribe en DUX." };

  it("sin poder escribir, el botón no se puede usar, dice por qué y deja a mano el plan B", () => {
    render(<Prueba escritura={FRENADO} />);

    expect(screen.getByRole("button", { name: "Publicar en DUX" })).toBeDisabled();
    expect(screen.getByText("Fuera de producción no se escribe en DUX.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bajar 1_productos.xls" })).toBeVisible();
  });
});

describe("a mano", () => {
  it("baja el archivo que se pidió, de lo que está guardado", async () => {
    const crearUrl = vi.fn(() => "blob:archivo");
    const clicEnElEnlace = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: crearUrl, revokeObjectURL: vi.fn() }));
    vi.mocked(bajarArchivoDeImportacion).mockResolvedValueOnce({
      ok: true,
      data: { nombre: "3_precios.xls", base64: btoa("xls") },
    });
    const guardarAntes = vi.fn(async () => "b1");

    render(<Prueba guardarAntes={guardarAntes} />);
    fireEvent.click(screen.getByRole("button", { name: "Bajar 3_precios.xls" }));

    await waitFor(() => expect(crearUrl).toHaveBeenCalledOnce());
    expect(clicEnElEnlace).toHaveBeenCalledOnce();
    expect(guardarAntes).toHaveBeenCalledOnce();
    expect(bajarArchivoDeImportacion).toHaveBeenCalledWith({ id: "b1", archivo: "3_precios" });
  });

  it("comprobar no valida ni guarda: con la importación hecha, el número ya figura como usado", async () => {
    vi.mocked(comprobarImportacionEnDux).mockResolvedValueOnce(responde(borrador([paso("LN1", "creado")], true)));
    const guardarAntes = vi.fn(async () => null);

    render(<Prueba guardarAntes={guardarAntes} />);
    fireEvent.click(screen.getByRole("button", { name: "Ya los importé: comprobar" }));

    expect(await screen.findByText("Está en DUX.")).toBeInTheDocument();
    expect(guardarAntes).not.toHaveBeenCalled();
    expect(comprobarImportacionEnDux).toHaveBeenCalledWith({ id: "b1" });
  });

  it("dice cuántos faltan", async () => {
    vi.mocked(comprobarImportacionEnDux).mockResolvedValueOnce(
      responde(borrador([paso("LN1", "creado"), paso("LN1-6", "pendiente", "Todavía no está en DUX.")])),
    );

    render(<Prueba />);
    fireEvent.click(screen.getByRole("button", { name: "Ya los importé: comprobar" }));

    expect(await screen.findByText("Todavía no está en DUX.")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Falta 1 código en DUX");
  });

  it("sin un borrador guardado no hay nada para comprobar", () => {
    render(<Prueba borradorId={null} />);

    expect(screen.getByRole("button", { name: "Ya los importé: comprobar" })).toBeDisabled();
  });
});

describe("a medio publicar", () => {
  it("avisa que ya no se puede cambiar", () => {
    render(<Prueba inicial={{ pasos: [paso("LN1", "creado"), paso("LN1-6", "pendiente")], enDux: false }} />);

    expect(screen.getByText(/no se puede cambiar desde acá/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retomar en DUX" })).toBeEnabled();
  });
});
