"use client";

import { Check, FileDown, LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api/browser";
import { toast } from "@/lib/toast";

/** Reclamo semanal a Transtech (RF-M7-06, RF-M7-09). El resumen llega renderizado del servidor. */
export function ReclamoDialog({
  titulo,
  descripcion,
  enviado,
  children,
}: {
  titulo: string;
  descripcion: string;
  enviado: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const marcarEnviado = () => {
    startTransition(async () => {
      try {
        await api.cobros.enviarReclamo();
        toast.success("Reclamo enviado a Federico", {
          description: "Queda en el historial de liquidaciones para seguir cada caso.",
        });
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("No se pudo marcar como enviado", { action: { label: "Reintentar", onClick: marcarEnviado } });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send />
          {enviado ? "Ver el reclamo de la semana" : "Armar el reclamo semanal"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">{children}</DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              toast.success("Excel descargado", {
                description: "Un renglón por caso: pedido, clienta, monto, estado en Zupply y lo que encontró la app.",
              })
            }
          >
            <FileDown />
            Exportar Excel
          </Button>
          <Button onClick={marcarEnviado} disabled={enviado || pending}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : enviado ? <Check /> : <Send />}
            {enviado ? "Enviado" : "Marcar como enviado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
