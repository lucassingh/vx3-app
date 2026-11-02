"use client";

import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/browser";
import { toast } from "@/lib/toast";

/** Cuenta ya formateada en el servidor. */
export type CuentaView = {
  id: string;
  nombre: string;
  saldo: number;
  saldoLabel: string;
  /** "hace 5 horas". */
  actualizado: string;
  origen: "extracto" | "manual";
  /** El saldo tiene más de un día: conviene actualizarlo antes de decidir. */
  viejo: boolean;
};

/** Saldos de cada cuenta. El de un banco sale del extracto; cualquiera se corrige a mano (RF-M7-10). */
export function CuentasCaja({ items }: { items: CuentaView[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [pending, startTransition] = useTransition();

  const editar = (item: CuentaView) => {
    setEditando(item.id);
    setValor(String(item.saldo));
  };

  const guardar = (item: CuentaView) => {
    const digitos = valor.replace(/\D/g, "");
    if (!digitos) {
      toast.error("Escribí el saldo en pesos", { description: "Solo números, sin signo ni decimales." });
      return;
    }
    startTransition(async () => {
      try {
        await api.cobros.actualizarSaldo(item.id, Number(digitos));
        setEditando(null);
        toast.success(`Saldo de ${item.nombre} actualizado`, {
          description: "Lo que se puede gastar hoy ya usa el saldo nuevo.",
        });
        router.refresh();
      } catch {
        toast.error("No se pudo guardar el saldo", { action: { label: "Reintentar", onClick: () => guardar(item) } });
      }
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cuenta</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead className="w-28">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <p className="font-medium">{item.nombre}</p>
              <p className="text-xs text-muted-foreground">Actualizado {item.actualizado}</p>
            </TableCell>
            <TableCell>
              {item.viejo ? (
                <Badge variant="warning">Saldo viejo</Badge>
              ) : (
                <Badge variant={item.origen === "extracto" ? "neutral" : "accent"}>
                  {item.origen === "extracto" ? "Extracto" : "Cargado a mano"}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {editando === item.id ? (
                <Input
                  autoFocus
                  inputMode="numeric"
                  aria-label={`Saldo de ${item.nombre}, en pesos`}
                  className="ml-auto h-8 w-36 text-right tabular-nums"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") guardar(item);
                    if (event.key === "Escape") setEditando(null);
                  }}
                />
              ) : (
                <span className="font-medium tabular-nums">{item.saldoLabel}</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              {editando === item.id ? (
                <div className="flex justify-end gap-1">
                  <Button size="icon-sm" onClick={() => guardar(item)} disabled={pending} aria-label="Guardar el saldo">
                    {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditando(null)}
                    disabled={pending}
                    aria-label="Cancelar"
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => editar(item)} aria-label={`Corregir el saldo de ${item.nombre}`}>
                  <Pencil aria-hidden />
                  Corregir
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
