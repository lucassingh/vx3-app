"use client";

import { Info, LoaderCircle, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/http";
import { toast } from "@/lib/toast";

type PausarButtonProps = {
  id: string;
  nombre: string;
  conjunto: string;
  estado: "activo" | "pausado";
};

/**
 * Pausar o reactivar un anuncio en Meta, con confirmación (RF-M9-07). Antes
 * de confirmar muestra cuántos cambios le quedan al conjunto en la hora.
 */
export function PausarButton({ id, nombre, conjunto, estado }: PausarButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const pausar = estado === "activo";

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setRestantes(null);
    api.pauta
      .cambiosDisponibles(id)
      .then((result) => setRestantes(result.cambiosRestantes))
      .catch(() => setRestantes(-1));
  };

  const confirmar = () => {
    startTransition(async () => {
      try {
        const result = await api.pauta.pausar(id, pausar);
        setOpen(false);
        toast.success(pausar ? "Anuncio pausado en Meta" : "Anuncio reactivado en Meta", {
          description: `“${nombre}”. Le quedan ${result.cambiosRestantes} cambios esta hora a “${conjunto}”.`,
        });
        router.refresh();
      } catch (error) {
        toast.error(pausar ? "No se pudo pausar el anuncio" : "No se pudo reactivar el anuncio", {
          description: error instanceof ApiError ? error.message : "Revisá la conexión e intentá de nuevo.",
        });
      }
    });
  };

  const sinCambios = restantes !== null && restantes <= 0 && restantes !== -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={pausar ? "outline" : "ghost"} size="sm">
          {pausar ? <Pause /> : <Play />}
          {pausar ? "Pausar" : "Reactivar"}
          <span className="sr-only"> {nombre}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pausar ? "¿Pausar" : "¿Reactivar"} “{nombre}”?
          </DialogTitle>
          <DialogDescription>
            {pausar
              ? "Se pausa en Meta al instante y deja de gastar. Lo podés reactivar cuando quieras."
              : "Vuelve a publicarse en Meta con el presupuesto que tenía su conjunto."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex gap-3 rounded-lg border border-border bg-muted/50 p-3 text-[13px]">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1.5">
              <p aria-live="polite">
                Meta permite hasta 4 cambios por hora en cada conjunto.{" "}
                {restantes === null ? (
                  <span className="text-muted-foreground">Consultando los de “{conjunto}”…</span>
                ) : restantes === -1 ? (
                  <span className="text-muted-foreground">No pudimos consultar los de “{conjunto}”.</span>
                ) : (
                  <span className="font-medium">
                    A “{conjunto}” le {restantes === 1 ? "queda 1" : `quedan ${restantes}`} esta hora.
                  </span>
                )}
              </p>
              <p className="text-muted-foreground">
                Conviene ir de a poco: los cambios grandes reinician el aprendizaje del conjunto.
              </p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={confirmar} disabled={pending || sinCambios}>
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            {pausar ? "Pausar anuncio" : "Reactivar anuncio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
