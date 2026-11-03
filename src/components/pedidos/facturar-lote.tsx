"use client";

import { LoaderCircle, ReceiptText, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type FacturableItem = {
  id: string;
  listo: boolean;
  /** Motivo por el que no se puede facturar todavía. */
  bloqueo?: string;
  /** Detalle del pedido renderizado en el servidor. */
  content: React.ReactNode;
};

/** Lista de pedidos para facturar con selección múltiple y "Facturar en lote" (RF-M5-04). */
export function FacturarLote({ items }: { items: FacturableItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(items.filter((item) => item.listo).map((item) => item.id)));
  const [pending, startTransition] = useTransition();
  const listos = items.filter((item) => item.listo);
  const allChecked = listos.length > 0 && listos.every((item) => selected.has(item.id));
  const someChecked = listos.some((item) => selected.has(item.id));
  const baseId = useId();

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const facturar = () => {
    const ids = [...selected];
    startTransition(async () => {
      const request = api.pedidos.facturar(ids);
      toast.promise(request, {
        loading: ids.length === 1 ? "Facturando el pedido en DUX…" : `Facturando ${ids.length} pedidos en DUX…`,
        success: ({ facturas }) => ({
          message: facturas.length === 1 ? "Comprobante emitido" : `${facturas.length} comprobantes emitidos`,
          description: `${facturas.map((factura) => factura.numero).join(" · ")}. El remito de armado ya está en la cola de impresión.`,
        }),
        error: "No se pudo facturar. Reintentá en un momento.",
      });
      try {
        await request;
        setSelected(new Set());
        router.refresh();
      } catch {
        // El aviso de error ya lo muestra toast.promise.
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-card">
        <label className="flex items-center gap-3 text-sm" htmlFor={`${baseId}-all`}>
          <Checkbox
            id={`${baseId}-all`}
            checked={allChecked ? true : someChecked ? "indeterminate" : false}
            disabled={listos.length === 0 || pending}
            onCheckedChange={(checked) =>
              setSelected(checked === true ? new Set(listos.map((item) => item.id)) : new Set())
            }
          />
          <span>
            <span className="font-medium">{selected.size}</span> de {listos.length}{" "}
            {listos.length === 1 ? "pedido listo seleccionado" : "pedidos listos seleccionados"}
          </span>
        </label>
        <Button onClick={facturar} disabled={selected.size === 0 || pending}>
          {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <ReceiptText />}
          {selected.size > 1 ? `Facturar en lote (${selected.size})` : "Facturar"}
        </Button>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const checkboxId = `${baseId}-${item.id}`;
          return (
            <li key={item.id}>
              <Card className={cn("flex gap-4 p-5 transition-colors", selected.has(item.id) && "border-primary/40")}>
                <div className="pt-0.5">
                  <Checkbox
                    id={checkboxId}
                    checked={selected.has(item.id)}
                    disabled={!item.listo || pending}
                    onCheckedChange={(checked) => toggle(item.id, checked === true)}
                    aria-label={
                      item.listo
                        ? `Seleccionar ${item.id}`
                        : `${item.id}: ${item.bloqueo ?? "no se puede facturar todavía"}`
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">{item.content}</div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Vuelve a pedir los datos de la pantalla (por ejemplo, el estado ante ARCA). */
export function RefreshButton({ label = "Actualizar" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RotateCw aria-hidden className={cn(pending && "animate-spin")} />
      {label}
    </Button>
  );
}
