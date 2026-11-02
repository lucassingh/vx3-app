"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { OrigenReclamo } from "@/lib/api/types";
import { toast } from "@/lib/toast";

/** Cierra el reclamo con su origen probable, que es obligatorio (RN-62). */
export function ResolverReclamo({
  id,
  origenInicial,
  origenes,
  ncNecesaria,
}: {
  id: string;
  origenInicial: OrigenReclamo | null;
  origenes: { id: OrigenReclamo; label: string }[];
  ncNecesaria: boolean;
}) {
  const router = useRouter();
  const selectId = useId();
  const [origen, setOrigen] = useState<OrigenReclamo | "">(origenInicial ?? "");
  const [pending, startTransition] = useTransition();

  const resolver = () => {
    if (!origen) return;
    startTransition(async () => {
      try {
        await api.postventa.resolver(id, origen);
        toast.success(`Reclamo ${id} resuelto`, {
          description: ncNecesaria
            ? "La nota de crédito queda vinculada al reclamo y al pedido."
            : "Queda registrado con su origen para el tablero de causas.",
        });
        router.refresh();
      } catch {
        toast.error("No se pudo cerrar el reclamo", { action: { label: "Reintentar", onClick: resolver } });
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={selectId}>Origen probable</Label>
        <NativeSelect
          id={selectId}
          value={origen}
          onChange={(event) => setOrigen(event.target.value as OrigenReclamo)}
          aria-describedby={`${selectId}-hint`}
          required
        >
          <option value="" disabled>
            Elegí el origen
          </option>
          {origenes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
        <p id={`${selectId}-hint`} className="text-xs text-muted-foreground">
          Nunca queda vacío: con esto se ataca la causa y no solo el reclamo.
        </p>
      </div>
      <Button onClick={resolver} disabled={!origen || pending} className="w-full">
        {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check />}
        {ncNecesaria ? "Marcar resuelto con la nota de crédito cargada" : "Marcar resuelto"}
      </Button>
    </div>
  );
}
