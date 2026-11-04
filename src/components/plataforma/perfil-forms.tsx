"use client";

import { LaptopMinimal, LoaderCircle, LogOut, Save, Smartphone } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/browser";
import { useCurrentUser } from "@/lib/auth";
import { toast } from "@/lib/toast";

/* ---- Datos ------------------------------------------------------------------ */

export function DatosForm() {
  const currentUser = useCurrentUser();
  const id = useId();
  const [nombre, setNombre] = useState(currentUser.name);
  const [telefono, setTelefono] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        await api.plataforma.perfil.actualizarDatos({ nombre, telefono });
        toast.success("Datos guardados");
      } catch (error) {
        toast.error("No se pudieron guardar los datos", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-nombre`}>Nombre</Label>
        <Input
          id={`${id}-nombre`}
          autoComplete="name"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          type="email"
          value={currentUser.email}
          readOnly
          aria-describedby={`${id}-email-desc`}
          className="bg-muted text-muted-foreground"
        />
        <p id={`${id}-email-desc`} className="text-xs text-muted-foreground">
          Es tu usuario para entrar. Para cambiarlo, pedíselo a Más Uno.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-tel`}>WhatsApp para las alertas</Label>
        <Input
          id={`${id}-tel`}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+54 9 11 0000-0000"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
          aria-describedby={`${id}-tel-desc`}
        />
        <p id={`${id}-tel-desc`} className="text-xs text-muted-foreground">
          Ahí te llegan las alertas que marcaste en Ajustes.
        </p>
      </div>
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" size="sm" disabled={pending || !nombre.trim()}>
          {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save />}
          Guardar datos
        </Button>
      </div>
    </form>
  );
}

/* ---- Seguridad -------------------------------------------------------------- */

export function SeguridadForm({ dosFactores, passwordLabel }: { dosFactores: boolean; passwordLabel: string }) {
  const id = useId();
  const [activado, setActivado] = useState(dosFactores);
  const [actualizada, setActualizada] = useState(passwordLabel);
  const [pending2fa, start2fa] = useTransition();

  const onToggle = (value: boolean) => {
    setActivado(value);
    start2fa(async () => {
      try {
        await api.plataforma.perfil.dosFactores(value);
        toast.success(value ? "Verificación en dos pasos activada" : "Verificación en dos pasos desactivada", {
          description: value ? "Desde el próximo ingreso te pedimos un código de tu app de autenticación." : undefined,
        });
      } catch {
        setActivado(!value);
        toast.error("No se pudo cambiar la verificación en dos pasos");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/50 p-3">
        <div className="space-y-0.5">
          <Label htmlFor={`${id}-2fa`}>Verificación en dos pasos</Label>
          <p className="text-[13px] text-muted-foreground">
            Opcional. Además de la contraseña, un código de una app como Google Authenticator.
          </p>
        </div>
        <Switch id={`${id}-2fa`} checked={activado} onCheckedChange={onToggle} disabled={pending2fa} />
      </div>

      <section className="space-y-4" aria-labelledby={`${id}-password`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={`${id}-password`} className="text-sm font-medium">
            Cambiar contraseña
          </h3>
          <p className="text-xs text-muted-foreground first-letter:uppercase">Última actualización: {actualizada}</p>
        </div>
        <ChangePasswordForm onDone={() => setActualizada("recién")} />
      </section>
    </div>
  );
}

/* ---- Sesiones --------------------------------------------------------------- */

export type SesionRow = {
  id: string;
  dispositivo: string;
  navegador: string;
  ubicacion: string;
  cuando: string;
  actual: boolean;
};

export function SesionesList({ initial }: { initial: SesionRow[] }) {
  const [sesiones, setSesiones] = useState(initial);
  const [pending, startTransition] = useTransition();

  const cerrar = (sesion: SesionRow) => {
    startTransition(async () => {
      try {
        await api.plataforma.perfil.cerrarSesion(sesion.id);
        setSesiones((current) => current.filter((item) => item.id !== sesion.id));
        toast.success(`Sesión cerrada en ${sesion.dispositivo}`, {
          description: "Para volver a entrar desde ahí va a necesitar la contraseña.",
        });
      } catch (error) {
        toast.error("No se pudo cerrar la sesión", { description: error instanceof Error ? error.message : undefined });
      }
    });
  };

  return (
    <ul className="divide-y divide-border">
      {sesiones.map((sesion) => {
        const Icon = sesion.dispositivo.toLowerCase().includes("iphone") ? Smartphone : LaptopMinimal;
        return (
          <li key={sesion.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {sesion.dispositivo}
                {sesion.actual && (
                  <Badge variant="success" dot>
                    Esta sesión
                  </Badge>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {sesion.navegador} · {sesion.ubicacion} · {sesion.actual ? "activa ahora" : sesion.cuando}
              </p>
            </div>
            {!sesion.actual && (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => cerrar(sesion)}>
                <LogOut />
                Cerrar<span className="sr-only"> la sesión en {sesion.dispositivo}</span>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
