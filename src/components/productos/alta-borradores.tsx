"use client";

import { FilePlus2, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CatalogoBorrador } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { borrarBorradorDeAlta } from "@/modules/catalog/actions";

const enDux = ({ publicacion }: CatalogoBorrador) => publicacion?.enDux ?? false;
/** Con un código creado en DUX ya no se puede borrar: DUX no los borra. */
const conCodigos = ({ publicacion }: CatalogoBorrador) =>
  publicacion?.pasos.some(({ estado }) => estado === "creado") ?? false;

const tituloDe = ({ input }: CatalogoBorrador) => input.prenda.trim() || input.nombre.trim() || "Sin nombre todavía";

function BorrarBorrador({
  borrador,
  alBorrar,
}: {
  borrador: CatalogoBorrador;
  alBorrar: (borrador: CatalogoBorrador) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmar = () =>
    startTransition(async () => {
      const resultado = await borrarBorradorDeAlta({ id: borrador.id });
      if (!resultado.ok) {
        toast.error("No se pudo borrar", { description: resultado.error.message });
        return;
      }
      toast.success("Borrador borrado");
      setAbierto(false);
      alBorrar(borrador);
    });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Borrar el borrador ${tituloDe(borrador)}`}
        onClick={() => setAbierto(true)}
      >
        <Trash2 />
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar este borrador?</DialogTitle>
            <DialogDescription>{tituloDe(borrador)}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Se pierde lo cargado. No toca nada en DUX ni en Tienda Nube.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={confirmar} disabled={pending}>
              {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Trash2 />}
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Las altas a medio cargar. Son de todo el equipo: una la empieza compras y la termina quien tiene las fotos. */
export function AltaBorradores({
  borradores,
  abiertoId,
  puedeEditar,
  alAbrir,
  alBorrar,
}: {
  borradores: CatalogoBorrador[];
  abiertoId: string | null;
  puedeEditar: boolean;
  alAbrir: (borrador: CatalogoBorrador | null) => void;
  alBorrar: (borrador: CatalogoBorrador) => void;
}) {
  if (borradores.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Borradores</CardTitle>
          <CardDescription>Altas a medio cargar. Todavía no están en DUX ni en Tienda Nube</CardDescription>
        </div>
        {abiertoId && (
          <Button type="button" variant="outline" size="sm" onClick={() => alAbrir(null)}>
            <FilePlus2 />
            Empezar otro
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="divide-y divide-border">
          {borradores.map((borrador) => {
            const abierto = borrador.id === abiertoId;
            return (
              <li key={borrador.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", abierto && "font-medium")}>
                    {borrador.input.sku && <span className="mr-2 font-mono text-xs">{borrador.input.sku}</span>}
                    {tituloDe(borrador)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {borrador.quien} · {formatRelativeTime(borrador.cuando)}
                    {enDux(borrador) ? " · Está en DUX" : conCodigos(borrador) ? " · A medio publicar" : ""}
                  </p>
                </div>
                {abierto ? (
                  <span className="text-xs text-muted-foreground">Abierto</span>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => alAbrir(borrador)}>
                    Abrir
                  </Button>
                )}
                {puedeEditar && !conCodigos(borrador) && <BorrarBorrador borrador={borrador} alBorrar={alBorrar} />}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
