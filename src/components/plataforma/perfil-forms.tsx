"use client";

import { LaptopMinimal, LoaderCircle, LogOut, Save, Smartphone } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/browser";
import { currentUser } from "@/lib/auth";
import { toast } from "@/lib/toast";

/* ---- Datos ------------------------------------------------------------------ */

export function DatosForm() {
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
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [actualizada, setActualizada] = useState(passwordLabel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (nueva.length < 10 || !/\d/.test(nueva)) {
      setError("La nueva contraseña necesita al menos 10 caracteres y un número.");
      return;
    }
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    startTransition(async () => {
      try {
        await api.plataforma.perfil.cambiarPassword({ actual, nueva });
        setActual("");
        setNueva("");
        setRepetida("");
        setError(null);
        setActualizada("recién");
        toast.success("Contraseña actualizada", {
          description: "En esta versión de demostración el ingreso sigue con la contraseña de siempre.",
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cambiar la contraseña.");
      }
    });
  };

  const errorProps = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
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

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">Cambiar contraseña</h3>
          <p className="text-xs text-muted-foreground first-letter:uppercase">Última actualización: {actualizada}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-actual`}>Contraseña actual</Label>
          <Input
            id={`${id}-actual`}
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
            {...errorProps}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-nueva`}>Nueva contraseña</Label>
            <Input
              id={`${id}-nueva`}
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(event) => setNueva(event.target.value)}
              {...errorProps}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-repetida`}>Repetila</Label>
            <Input
              id={`${id}-repetida`}
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(event) => setRepetida(event.target.value)}
              {...errorProps}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Al menos 10 caracteres y un número.</p>
        {error && (
          <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={pending || !actual || !nueva || !repetida}>
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
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
