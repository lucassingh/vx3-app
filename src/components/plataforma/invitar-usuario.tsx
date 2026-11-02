"use client";

import { LoaderCircle, Send, UserPlus } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { RolUsuario } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { ROL } from "./shared";

const DESCRIPCION: Record<RolUsuario, string> = {
  admin: "Todo, incluida la configuración de reglas, del bot y de las integraciones.",
  operaciones: "Pedidos, facturación, cobros, compras y catálogo.",
  postventa: "Reclamos, notas de crédito y etiquetas; ve pedidos y clientas.",
  compras: "Compras, altas de producto, costos y catálogo.",
  marketing: "Pauta, presupuestos y el vínculo de cada anuncio con su producto.",
  solo_lectura: "Solo ve. Para el contador o la vista de la liquidación de la mensajería.",
};

export function InvitarUsuario() {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolUsuario>("operaciones");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setEmail("");
    setRol("operaciones");
    setError(null);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Revisá el email.");
      return;
    }
    startTransition(async () => {
      try {
        await api.plataforma.usuarios.invitar({ email: email.trim(), rol });
        toast.success(`Invitación enviada a ${email.trim()}`, {
          description: `Entra con el rol ${ROL[rol]}. Le llega un mail para crear su contraseña.`,
        });
        reset();
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo enviar la invitación.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Invitar a alguien del equipo</DialogTitle>
            <DialogDescription>Cada persona entra con su usuario y ve solo lo que su rol permite.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-email`}>Email</Label>
              <Input
                id={`${id}-email`}
                type="email"
                autoComplete="off"
                placeholder="nombre@vx3.com.ar"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-rol`}>Rol</Label>
              <NativeSelect
                id={`${id}-rol`}
                value={rol}
                onChange={(event) => setRol(event.target.value as RolUsuario)}
                aria-describedby={`${id}-rol-desc`}
              >
                {(Object.keys(ROL) as RolUsuario[]).map((value) => (
                  <option key={value} value={value}>
                    {ROL[value]}
                  </option>
                ))}
              </NativeSelect>
              <p id={`${id}-rol-desc`} className="text-[13px] text-muted-foreground">
                {DESCRIPCION[rol]}
              </p>
            </div>
            {error && (
              <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !email}>
              {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send />}
              {pending ? "Enviando…" : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
