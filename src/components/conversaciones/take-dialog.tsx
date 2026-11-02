"use client";

import { UserCheck } from "lucide-react";
import { useState } from "react";
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
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Tomar una conversación: el bot se aparta y queda registrado el motivo
 * (RF-M11-11). Así hay datos de por qué el bot no alcanzó.
 */
export function TakeDialog({
  open,
  onOpenChange,
  motivos,
  clienta,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motivos: string[];
  clienta: string;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState(motivos[0] ?? "Otro");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(motivo);
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Tomar la conversación con {clienta}</DialogTitle>
            <DialogDescription>
              El bot deja de responder hasta que la devuelvas o la cierres.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <fieldset>
              <legend className="mb-3 text-[13px] font-medium">¿Por qué la tomás?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {motivos.map((item) => (
                  <label
                    key={item}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-[13px] transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/8 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    )}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={item}
                      checked={motivo === item}
                      onChange={() => setMotivo(item)}
                      className="size-3.5 accent-primary"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit">
              <UserCheck />
              Tomar conversación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
