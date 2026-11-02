"use client";

import { CheckCheck, GitMerge, LoaderCircle } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";
import type { DuplicadoClienta } from "@/lib/api/types";
import { toast } from "@/lib/toast";

/** Duplicados detectados por teléfono normalizado. Fusionar los une en una sola ficha. */
export function DuplicadosList({ initialItems }: { initialItems: DuplicadoClienta[] }) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [optimisticItems, removeOptimistic] = useOptimistic(items, (current, id: string) =>
    current.filter((item) => item.id !== id),
  );

  const fusionar = (item: DuplicadoClienta) => {
    setPendingId(item.id);
    startTransition(async () => {
      removeOptimistic(item.id);
      try {
        const { fusionados } = await api.clientas.fusionar(item.id);
        startTransition(() => setItems((current) => current.filter((entry) => entry.id !== item.id)));
        toast.success(`Ficha de ${item.nombre} unificada`, {
          description: `${fusionados} registros unidos por el teléfono ${item.telefonoNormalizado}.`,
        });
      } catch {
        toast.error(`No se pudo fusionar la ficha de ${item.nombre}`, {
          description: "Revisá la conexión e intentá de nuevo.",
          action: { label: "Reintentar", onClick: () => fusionar(item) },
        });
      } finally {
        setPendingId(null);
      }
    });
  };

  if (optimisticItems.length === 0) {
    return (
      <EmptyState
        icon={CheckCheck}
        title="No hay duplicados pendientes"
        description="Cada clienta tiene una sola ficha. Si aparece un teléfono repetido en otro sistema, lo vas a ver acá."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {optimisticItems.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-medium">{item.nombre}</p>
              <span className="font-mono text-xs text-muted-foreground">{item.telefonoNormalizado}</span>
            </div>
            <p className="text-[13px] text-muted-foreground">{item.motivo}</p>
            <ul className="flex flex-wrap gap-2">
              {item.registros.map((registro, index) => (
                <li
                  key={`${registro.sistema}-${index}`}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <Badge variant="outline">{registro.sistema}</Badge>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{registro.nombre}</span>
                    <span className="block truncate text-muted-foreground">{registro.detalle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start sm:self-center"
            disabled={pendingId === item.id}
            onClick={() => fusionar(item)}
          >
            {pendingId === item.id ? <LoaderCircle className="animate-spin" /> : <GitMerge />}
            Fusionar<span className="sr-only"> la ficha de {item.nombre}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
