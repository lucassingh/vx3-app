"use client";

import { LoaderCircle, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
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
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/http";
import { toast } from "@/lib/toast";

type MontoDialogProps = {
  /** Qué se edita: el tipo de cambio de Meta o el presupuesto de una campaña. */
  target: { kind: "tipo-cambio" } | { kind: "presupuesto"; campanaId: string; campana: string };
  initialValue: number;
  /** Texto del botón que abre el diálogo. */
  triggerLabel: string;
  /** Nombre accesible del botón cuando el texto no alcanza ("Editar el presupuesto de …"). */
  triggerAriaLabel?: string;
  triggerVariant?: "outline" | "ghost";
};

const COPY = {
  "tipo-cambio": {
    title: "Actualizar el tipo de cambio",
    description: "El gasto de Meta está en dólares. Con este valor se pasa a pesos y se recalcula el RM de cada anuncio.",
    label: "Pesos por dólar",
    prefix: "$",
  },
  presupuesto: {
    title: "Editar el presupuesto del mes",
    description: "Es lo planificado para la campaña. No cambia nada en Meta: sirve para medir el desvío.",
    label: "Presupuesto mensual",
    prefix: "US$",
  },
} as const;

/** Diálogo para editar un monto (tipo de cambio o presupuesto), con aviso al guardar. */
export function MontoDialog({
  target,
  initialValue,
  triggerLabel,
  triggerAriaLabel,
  triggerVariant = "outline",
}: MontoDialogProps) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copy = COPY[target.kind];

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numero = Number(value.replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) {
      setError("Ingresá un monto mayor a 0.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (target.kind === "tipo-cambio") {
          await api.pauta.actualizarTipoCambio(numero);
          toast.success("Tipo de cambio actualizado", {
            description: "El gasto en pesos y el RM de cada anuncio ya usan el valor nuevo.",
          });
        } else {
          await api.pauta.actualizarPresupuesto(target.campanaId, numero);
          toast.success("Presupuesto actualizado", { description: target.campana });
        }
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "No se pudo guardar. Probá de nuevo.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(String(initialValue));
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" aria-label={triggerAriaLabel}>
          <Pencil />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {target.kind === "presupuesto" ? `${target.campana}. ${copy.description}` : copy.description}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <Label htmlFor={inputId}>{copy.label}</Label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              >
                {copy.prefix}
              </span>
              <Input
                id={inputId}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={target.kind === "presupuesto" ? "pl-12" : "pl-7"}
                autoFocus
              />
            </div>
            {error && (
              <p id={errorId} role="alert" className="text-[13px] font-medium text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
