"use client";

import { ArrowLeftRight, Check, CircleCheck, CircleX, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Propuesta ya formateada en el servidor. */
export type PropuestaView = {
  id: string;
  puntaje: number;
  banco: string;
  monto: string;
  titular: string;
  /** "14:35 · hace 1 hora". */
  cuando: string;
  /** "Fecha del banco: 27/10". */
  fechaBanco: string;
  antiguedad?: { label: string; tone: "warning" | "danger" };
  pedidoId: string;
  clienta: string;
  totalPedido: string;
  razones: { label: string; ok: boolean }[];
};

const UMBRAL_ALTO = 90;

function scoreTone(puntaje: number) {
  return puntaje >= UMBRAL_ALTO ? "success" : puntaje >= 75 ? "warning" : "neutral";
}

/** Cruces propuestos por el motor de matching (RF-M7-03): la persona confirma. */
export function Propuestas({ items }: { items: PropuestaView[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visibles = items.filter((item) => !hidden.has(item.id));
  const altos = visibles.filter((item) => item.puntaje >= UMBRAL_ALTO);

  const hide = (ids: string[]) => setHidden((current) => new Set([...current, ...ids]));

  const confirmar = (item: PropuestaView) => {
    setBusy(item.id);
    startTransition(async () => {
      try {
        const { cobro } = await api.cobros.confirmar(item.id);
        hide([item.id]);
        toast.success("Cobro registrado en DUX", {
          description: `${cobro} · ${item.pedidoId} por ${item.monto}, con la ${item.fechaBanco.toLowerCase()}.`,
        });
        router.refresh();
      } catch {
        toast.error("No se pudo registrar el cobro", {
          description: "DUX no respondió. La propuesta sigue pendiente.",
          action: { label: "Reintentar", onClick: () => confirmar(item) },
        });
      } finally {
        setBusy(null);
      }
    });
  };

  const rechazar = (item: PropuestaView) => {
    setBusy(item.id);
    startTransition(async () => {
      try {
        await api.cobros.rechazar(item.id);
        hide([item.id]);
        toast.success("Cruce descartado", { description: `${item.titular} queda como movimiento sin cruce.` });
        router.refresh();
      } catch {
        toast.error("No se pudo descartar el cruce");
      } finally {
        setBusy(null);
      }
    });
  };

  const confirmarAltos = () => {
    setBusy("altos");
    startTransition(async () => {
      try {
        const { confirmadas } = await api.cobros.confirmarAltos();
        hide(altos.map((item) => item.id));
        toast.success(confirmadas === 1 ? "1 cobro registrado en DUX" : `${confirmadas} cobros registrados en DUX`, {
          description: "Cada uno con la fecha del banco, la caja Cuenta y la imputación a su venta.",
        });
        router.refresh();
      } catch {
        toast.error("No se pudieron registrar los cobros", { action: { label: "Reintentar", onClick: confirmarAltos } });
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
        <p className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{visibles.length}</span> por revisar ·{" "}
          <span className="tabular-nums">{altos.length}</span> con puntaje de {UMBRAL_ALTO} o más
        </p>
        <Button size="sm" onClick={confirmarAltos} disabled={altos.length === 0 || pending}>
          {busy === "altos" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check />}
          Confirmar los de puntaje alto
        </Button>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="Todo conciliado"
          description="No quedan transferencias con cruce propuesto."
          className="border-t border-border"
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {visibles.map((item) => (
            <li key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
              <div
                className={cn(
                  "grid size-12 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums",
                  scoreTone(item.puntaje) === "success" && "border-success/50 text-success",
                  scoreTone(item.puntaje) === "warning" && "border-warning/50 text-warning",
                  scoreTone(item.puntaje) === "neutral" && "border-border-strong text-muted-foreground",
                )}
              >
                <span className="sr-only">Puntaje </span>
                {item.puntaje}
              </div>

              <div className="min-w-0 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.monto} · <span className="font-mono text-[13px]">{item.titular}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.banco} · {item.cuando}
                    </p>
                  </div>
                  <ArrowLeftRight aria-hidden className="hidden size-4 text-muted-foreground sm:block" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="font-mono">{item.pedidoId}</span> · {item.clienta}
                    </p>
                    <p className="text-xs text-muted-foreground">Total del pedido {item.totalPedido}</p>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {item.razones.map((razon) => (
                    <li key={razon.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {razon.ok ? (
                        <CircleCheck aria-hidden className="size-3.5 text-success" />
                      ) : (
                        <CircleX aria-hidden className="size-3.5 text-warning" />
                      )}
                      <span className="sr-only">{razon.ok ? "Bien: " : "Atención: "}</span>
                      {razon.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {item.antiguedad && (
                  <Badge variant={item.antiguedad.tone} dot>
                    {item.antiguedad.label}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => rechazar(item)}
                  disabled={pending}
                  aria-label={`Rechazar el cruce de ${item.titular} con ${item.pedidoId}`}
                >
                  <X />
                  Rechazar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirmar(item)}
                  disabled={pending}
                  aria-label={`Confirmar el cruce de ${item.titular} con ${item.pedidoId}`}
                >
                  {busy === item.id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check />}
                  Confirmar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
