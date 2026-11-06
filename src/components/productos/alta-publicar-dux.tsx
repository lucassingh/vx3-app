"use client";

import { Check, Download, LoaderCircle, PackageCheck, RotateCcw, Upload, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogoBorrador, CatalogoEscrituraEnDux, CatalogoPasoDeDux } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  avanzarPublicacionEnDux,
  bajarArchivoDeImportacion,
  comprobarImportacionEnDux,
} from "@/modules/catalog/actions";
import type { ArchivoDeImportacion } from "@/modules/catalog/publicar";

/** Como en el Hub: se importan en este orden, cada uno con su opción (Productos › Importar). */
const ARCHIVOS: { archivo: ArchivoDeImportacion; opcion: string }[] = [
  { archivo: "1_productos", opcion: "Productos" },
  { archivo: "2_compuestos", opcion: "Compuesto" },
  { archivo: "3_precios", opcion: "Múltiples precios" },
];

/** Vuelta de seguridad: cada llamada hace un código, y un producto tiene 5 como mucho. */
const MAXIMO_DE_PASOS = 12;

function guardarArchivo(nombre: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.ms-excel" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

function Paso({ paso, enCurso }: { paso: CatalogoPasoDeDux; enCurso: boolean }) {
  const { codigo, estado, detalle } = paso;
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
          estado === "creado" && "border-success bg-success text-surface",
          estado === "error" && "border-danger bg-danger text-surface",
          estado === "pendiente" && !enCurso && "border-border-strong text-muted-foreground",
          enCurso && "border-primary text-primary",
        )}
      >
        {enCurso ? (
          <LoaderCircle aria-hidden className="size-3 animate-spin" />
        ) : estado === "creado" ? (
          <Check aria-hidden className="size-3" strokeWidth={3} />
        ) : estado === "error" ? (
          <X aria-hidden className="size-3" strokeWidth={3} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("font-mono text-xs", estado === "pendiente" && !enCurso && "text-muted-foreground")}>
          {codigo}
        </span>
        <span className="sr-only">
          {enCurso ? ": en curso" : estado === "creado" ? ": creado" : estado === "error" ? ": falló" : ": falta"}
        </span>
        {detalle && (
          <span className={cn("block text-xs", estado === "error" ? "text-danger" : "text-muted-foreground")}>
            {detalle}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Publicar en DUX, de a un código, con los `.xls` como plan B. Si se corta, el botón lo retoma: el
 * estado queda en el borrador, y antes de crear un código siempre se lo busca.
 */
export function AltaPublicarEnDux({
  borradorId,
  publicacion,
  escritura,
  guardarAntes,
  alActualizar,
}: {
  borradorId: string | null;
  publicacion: CatalogoBorrador["publicacion"];
  escritura: CatalogoEscrituraEnDux;
  /** Valida y guarda lo que hay en pantalla. Null: no se puede seguir, y ya lo dijo. */
  guardarAntes: () => Promise<string | null>;
  alActualizar: (borrador: CatalogoBorrador) => void;
}) {
  const [publicando, setPublicando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [bajando, setBajando] = useState<ArchivoDeImportacion | null>(null);

  const pasos = publicacion?.pasos ?? [];
  const enDux = publicacion?.enDux ?? false;
  const enCurso = publicando ? pasos.find(({ estado }) => estado !== "creado")?.codigo : undefined;
  const empezado = pasos.some(({ estado }) => estado === "creado");
  const ocupado = publicando || comprobando || bajando !== null;

  const publicar = async () => {
    setPublicando(true);
    try {
      const id = await guardarAntes();
      if (!id) return;
      for (let vuelta = 0; vuelta < MAXIMO_DE_PASOS; vuelta++) {
        const resultado = await avanzarPublicacionEnDux({ id });
        if (!resultado.ok) {
          toast.error("No se pudo publicar", { description: resultado.error.message });
          return;
        }
        alActualizar(resultado.data);
        if (resultado.data.publicacion?.enDux) {
          toast.success("Quedó en DUX", {
            description: `Se crearon sus ${resultado.data.publicacion.pasos.length} códigos.`,
          });
          return;
        }
        const conError = resultado.data.publicacion?.pasos.find(({ estado }) => estado === "error");
        if (conError) {
          toast.error(`DUX no aceptó ${conError.codigo}`, { description: conError.detalle ?? undefined });
          return;
        }
      }
    } finally {
      setPublicando(false);
    }
  };

  const bajar = async (archivo: ArchivoDeImportacion) => {
    setBajando(archivo);
    try {
      const id = await guardarAntes();
      if (!id) return;
      const resultado = await bajarArchivoDeImportacion({ id, archivo });
      if (!resultado.ok) {
        toast.error("No se pudo armar el archivo", { description: resultado.error.message });
        return;
      }
      guardarArchivo(resultado.data.nombre, resultado.data.base64);
    } finally {
      setBajando(null);
    }
  };

  /** Sin validar ni guardar: con la importación hecha, el número ya figura como usado, y frenaría acá. */
  const comprobar = async () => {
    if (!borradorId) return;
    setComprobando(true);
    try {
      const resultado = await comprobarImportacionEnDux({ id: borradorId });
      if (!resultado.ok) {
        toast.error("No se pudo comprobar", { description: resultado.error.message });
        return;
      }
      alActualizar(resultado.data);
      const faltan = resultado.data.publicacion?.pasos.filter(({ estado }) => estado !== "creado").length ?? 0;
      if (faltan === 0) toast.success("Quedó en DUX", { description: "Están todos sus códigos." });
      else toast.error(faltan === 1 ? "Falta 1 código en DUX" : `Faltan ${faltan} códigos en DUX`);
    } finally {
      setComprobando(false);
    }
  };

  return (
    <div className="space-y-3">
      {pasos.length > 0 && (
        <ol className="space-y-2" aria-label="Códigos en DUX">
          {pasos.map((paso) => (
            <Paso key={paso.codigo} paso={paso} enCurso={paso.codigo === enCurso} />
          ))}
        </ol>
      )}

      {enDux ? (
        <p className="flex items-center gap-2 text-sm font-medium" role="status">
          <PackageCheck aria-hidden className="size-4 text-success" />
          Está en DUX. Aparece en el catálogo con la próxima sincronización.
        </p>
      ) : (
        <>
          <Button className="w-full" onClick={publicar} disabled={ocupado || !escritura.puede}>
            {publicando ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : pasos.length > 0 ? (
              <RotateCcw />
            ) : (
              <Upload />
            )}
            {publicando ? "Publicando…" : pasos.length > 0 ? "Retomar en DUX" : "Publicar en DUX"}
          </Button>
          {escritura.motivo && <p className="text-xs text-muted-foreground">{escritura.motivo}</p>}

          <details className="rounded-lg border border-border p-3 text-sm" open={!escritura.puede}>
            <summary className="cursor-pointer font-medium">Importar a mano en DUX</summary>
            <div className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Si la API no responde. En DUX, Productos › Importar, en este orden, cada uno con su opción:
              </p>
              <ol className="space-y-1.5">
                {ARCHIVOS.map(({ archivo, opcion }) => (
                  <li key={archivo} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-xs">
                      <span className="font-mono">{archivo}.xls</span>
                      <span className="block text-muted-foreground">Opción “{opcion}”</span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ocupado}
                      aria-label={`Bajar ${archivo}.xls`}
                      onClick={() => void bajar(archivo)}
                    >
                      {bajando === archivo ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download />}
                      Bajar
                    </Button>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                Después subí la foto principal a la prenda y a sus packs: el archivo no la lleva.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={ocupado || !borradorId}
                onClick={comprobar}
              >
                {comprobando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check />}
                {comprobando ? "Comprobando…" : "Ya los importé: comprobar"}
              </Button>
            </div>
          </details>
        </>
      )}

      {empezado && !enDux && (
        <p className="text-xs text-muted-foreground">
          Ya hay códigos en DUX: este producto no se puede cambiar desde acá. Lo que falta se retoma sin duplicar.
        </p>
      )}
    </div>
  );
}
