"use client";

import { LoaderCircle, Scissors, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { hacerElCorteDelCatalogo, volverAtrasElCorte } from "@/modules/catalog/actions";
import type { EstadoDelCorte } from "@/modules/catalog/corte";

/** `solucion_doc/06` §6.2. Solo admin: cambia de dónde sale el catálogo para todo el equipo. */
export function CorteDelCatalogo({ corte }: { corte: EstadoDelCorte }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmar = () =>
    startTransition(async () => {
      const resultado = corte ? await volverAtrasElCorte({}) : await hacerElCorteDelCatalogo({});
      if (!resultado.ok) {
        toast.error(corte ? "No se pudo volver atrás" : "No se pudo hacer el corte", {
          description: resultado.error.message,
        });
        return;
      }
      toast.success(corte ? "Volvió el Sheet" : "El corte está en marcha", {
        description: corte
          ? "La próxima importación lee el Sheet y Drive."
          : "Hace la última importación. Si falla, no corta: lo dice en Integraciones.",
      });
      setAbierto(false);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Corte del catálogo</CardTitle>
          <CardDescription>
            {corte
              ? `Hecho el ${formatDate(corte.cortadoEl, { day: "numeric", month: "numeric" })} por ${corte.por}. El catálogo se edita acá, y sigue leyendo DUX`
              : "Hoy el catálogo sale del Sheet y Drive. Con el corte, se edita solo en la app"}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
          {corte ? <Undo2 /> : <Scissors />}
          {corte ? "Volver atrás" : "Hacer el corte"}
        </Button>
      </CardHeader>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{corte ? "¿Volver al Sheet?" : "¿Hacer el corte?"}</DialogTitle>
            <DialogDescription>
              {corte ? "El Sheet quedó intacto." : "Hacelo con el equipo sin tocar el Sheet ni las altas del Hub."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {corte ? (
              <p className="text-sm text-muted-foreground">
                La próxima importación lee el Sheet y Drive de nuevo: lo que se editó acá sobre esos productos se pisa.
                Las altas nuevas hechas en la app se mantienen, y las decisiones de la revisión también.
              </p>
            ) : (
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>La app hace la última importación del Sheet y Drive.</li>
                <li>Si sale bien, el catálogo deja de leerlos, y sigue leyendo DUX todas las noches.</li>
                <li>Desde ahí se edita solo acá: el Sheet pasa a solo lectura y se apagan las altas del Hub.</li>
              </ol>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmar} disabled={pending}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              {corte ? "Volver atrás" : "Hacer el corte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CardContent className="hidden" />
    </Card>
  );
}
