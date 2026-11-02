"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";
import type { StockDiferencia } from "@/lib/api/types";
import { toast } from "@/lib/toast";

export type DiferenciaFila = StockDiferencia & { cuando: string };

/** Faltantes en góndola con su propuesta de ajuste en DUX (RF-M2-12). */
export function DiferenciasList({ items }: { items: DiferenciaFila[] }) {
  const [filas, setFilas] = useState(items);
  const [enviando, setEnviando] = useState<string | null>(null);

  const proponer = async (fila: DiferenciaFila) => {
    setEnviando(fila.id);
    try {
      await api.stock.proponerAjuste(fila.id);
      setFilas((actual) => actual.map((item) => (item.id === fila.id ? { ...item, estado: "propuesto" } : item)));
      toast.success(`Ajuste de ${fila.sku} propuesto en DUX`, {
        description: `De ${fila.duxPrendas} a ${fila.contadoPrendas} prendas. Queda en el registro de auditoría.`,
      });
    } catch {
      toast.error("No se pudo proponer el ajuste", {
        description: "DUX no respondió. Probá de nuevo.",
        action: { label: "Reintentar", onClick: () => proponer(fila) },
      });
    } finally {
      setEnviando(null);
    }
  };

  return (
    <ul className="divide-y divide-border">
      {filas.map((fila) => {
        const diferencia = fila.contadoPrendas - fila.duxPrendas;
        return (
          <li key={fila.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{fila.sku}</span>
                <span className="truncate font-medium">{fila.nombre}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fila.causa} · {fila.detectadoEn}, <span className="first-letter:lowercase">{fila.cuando}</span>
              </p>
            </div>
            <p className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
              <span className="text-muted-foreground">DUX {fila.duxPrendas}</span>
              <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
              <span className="font-medium">Góndola {fila.contadoPrendas}</span>
              <Badge variant="danger">{diferencia} prendas</Badge>
            </p>
            <div className="shrink-0 sm:w-44 sm:text-right">
              {fila.estado === "propuesto" ? (
                <Badge variant="success" dot>
                  <Check aria-hidden className="size-3" />
                  Ajuste propuesto
                </Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => proponer(fila)} disabled={enviando === fila.id}>
                  {enviando === fila.id && <LoaderCircle aria-hidden className="animate-spin" />}
                  Proponer ajuste en DUX
                  <span className="sr-only"> para {fila.sku}</span>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
