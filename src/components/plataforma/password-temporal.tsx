"use client";

import { CopyButton } from "@/components/ui/copy-button";

/** La contraseña temporal recién generada: se muestra una sola vez. */
export function PasswordTemporal({ password }: { password: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <code className="font-mono text-base tracking-wide text-foreground" aria-label="Contraseña temporal">
          {password}
        </code>
        <CopyButton value={password} label="Copiar la contraseña temporal" successMessage="Contraseña copiada" />
      </div>
      <p className="text-[13px] text-muted-foreground">
        No se vuelve a mostrar. Pasásela por un canal privado (WhatsApp, en persona). Al entrar, la app le pide que
        elija una propia.
      </p>
    </div>
  );
}
