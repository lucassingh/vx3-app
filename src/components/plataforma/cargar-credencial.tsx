"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
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
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { cargarCredencial } from "@/modules/platform/credentials/actions";
import type { IntegracionConCredencial } from "@/modules/platform/credentials/integraciones";

/** RF-M0-06 · Carga o reemplaza una credencial. Lo escrito no se vuelve a mostrar: queda solo la máscara. */
export function CargarCredencial({
  integracion,
  nombre,
  yaCargada,
}: {
  integracion: IntegracionConCredencial;
  nombre: string;
  yaCargada: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const valor = String(new FormData(form).get("valor") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await cargarCredencial({ integracion, valor });
      if (!result.ok) {
        setError(result.error.fieldErrors?.valor?.[0] ?? result.error.message);
        requestAnimationFrame(() => form.querySelector<HTMLInputElement>("input")?.focus());
        return;
      }
      setOpen(false);
      toast.success(`Credencial de ${nombre} guardada`, {
        description:
          integracion === "google"
            ? `Es la de ${result.data.mascara.replace(/^•+/, "")}.`
            : `Termina en ${result.data.mascara}.`,
      });
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(abierto) => {
        setOpen(abierto);
        if (!abierto) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <KeyRound />
          {yaCargada ? "Cambiar credencial" : "Cargar credencial"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Credencial de {nombre}</DialogTitle>
            <DialogDescription>
              Se guarda cifrada y no se vuelve a mostrar: queda solo el final, para reconocerla. El cambio queda en la
              auditoría.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor={`${id}-valor`}>
                {integracion === "google" ? "Clave de la cuenta de servicio (el archivo JSON entero)" : "Token"}
              </Label>
              <Input
                id={`${id}-valor`}
                name="valor"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              {error && (
                <p id={`${id}-error`} className="text-[13px] font-medium text-danger">
                  {error}
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
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
