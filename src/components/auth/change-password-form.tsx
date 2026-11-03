"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { changePassword } from "@/modules/platform/auth/actions";

const MIN_LENGTH = 12;

type Campo = "actual" | "nueva" | "repetida";

/**
 * Cambio de contraseña: en el primer ingreso (contraseña temporal) y desde Mi
 * perfil. Al guardar se cierran las otras sesiones abiertas.
 */
export function ChangePasswordForm({
  onDone,
  submitLabel = "Cambiar contraseña",
}: {
  onDone: () => void;
  submitLabel?: string;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [errores, setErrores] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setErrores({});
    setGeneral(null);
    startTransition(async () => {
      const result = await changePassword({
        actual: String(data.get("actual") ?? ""),
        nueva: String(data.get("nueva") ?? ""),
        repetida: String(data.get("repetida") ?? ""),
      });
      if (!result.ok) {
        const porCampo = result.error.fieldErrors ?? {};
        setErrores(porCampo);
        if (Object.keys(porCampo).length === 0) setGeneral(result.error.message);
        // El foco va al primer campo con error, para que el lector de pantalla lo lea.
        requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
        return;
      }
      form.reset();
      toast.success("Contraseña cambiada", { description: "Cerramos tus otras sesiones abiertas." });
      onDone();
    });
  };

  const campo = (name: Campo, label: string, autoComplete: string, hint?: string) => {
    const error = errores[name]?.[0];
    const describedBy = [hint && `${id}-${name}-hint`, error && `${id}-${name}-error`].filter(Boolean).join(" ");
    return (
      <div className="space-y-2">
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        <Input
          id={`${id}-${name}`}
          name={name}
          type="password"
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          required
        />
        {hint && (
          <p id={`${id}-${name}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-${name}-error`} className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {campo("actual", "Contraseña actual", "current-password")}
      {campo(
        "nueva",
        "Contraseña nueva",
        "new-password",
        `Al menos ${MIN_LENGTH} caracteres. Una frase que recuerdes sirve más que una palabra rara.`,
      )}
      {campo("repetida", "Repetí la contraseña nueva", "new-password")}

      {general && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {general}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <LoaderCircle aria-hidden className="animate-spin" />}
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
