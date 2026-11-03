"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
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
import type { FieldErrors } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { type Role, ROLES } from "@/modules/platform/permissions";
import { crearUsuario } from "@/modules/platform/users/actions";
import { PasswordTemporal } from "./password-temporal";
import { ROL } from "./shared";

export const DESCRIPCION_ROL: Record<Role, string> = {
  admin: "Todo, incluida la configuración de reglas, del bot, de las integraciones y de los usuarios.",
  operaciones: "Conversaciones, pedidos, facturación, cobros, envíos, compras y catálogo.",
  postventa: "Reclamos, notas de crédito, envíos y conversaciones; ve pedidos y catálogo.",
  compras: "Compras, altas de producto, costos y catálogo.",
  marketing: "Pauta y presupuestos; ve conversaciones, catálogo y el bot.",
  solo_lectura: "Solo ve pedidos, cobros, envíos, compras y pauta. Para el contador o la mensajería.",
};

type Creado = { nombre: string; passwordTemporal: string };

export function CrearUsuario() {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rol, setRol] = useState<Role>("operaciones");
  const [errores, setErrores] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [creado, setCreado] = useState<Creado | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setRol("operaciones");
    setErrores({});
    setGeneral(null);
    setCreado(null);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setErrores({});
    setGeneral(null);
    startTransition(async () => {
      const result = await crearUsuario({
        nombre: String(data.get("nombre") ?? ""),
        email: String(data.get("email") ?? ""),
        usuario: String(data.get("usuario") ?? ""),
        rol,
        puesto: String(data.get("puesto") ?? ""),
      });
      if (!result.ok) {
        setErrores(result.error.fieldErrors ?? {});
        if (!result.error.fieldErrors) setGeneral(result.error.message);
        requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
        return;
      }
      setCreado(result.data);
      toast.success(`${result.data.nombre} ya tiene usuario`);
      router.refresh();
    });
  };

  const campo = (
    name: "nombre" | "email" | "usuario" | "puesto",
    label: string,
    props: React.ComponentProps<typeof Input>,
    hint?: string,
  ) => {
    const error = errores[name]?.[0];
    const describedBy = [hint && `${id}-${name}-hint`, error && `${id}-${name}-error`].filter(Boolean).join(" ");
    return (
      <div className="space-y-2">
        <Label htmlFor={`${id}-${name}`}>{label}</Label>
        <Input
          id={`${id}-${name}`}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
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
          Crear usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        {creado ? (
          <div className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>{creado.nombre} ya tiene usuario</DialogTitle>
              <DialogDescription>
                Pasale esta contraseña temporal: al entrar, la app le pide una propia.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <PasswordTemporal password={creado.passwordTemporal} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Crear un usuario</DialogTitle>
              <DialogDescription>
                Cada persona entra con su usuario y ve solo lo que su rol permite. Le vas a pasar una contraseña
                temporal que cambia al entrar.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {campo("nombre", "Nombre y apellido", { autoComplete: "off", required: true })}
              {campo("email", "Email", { type: "email", autoComplete: "off", placeholder: "nombre@vx3.com.ar" })}
              {campo(
                "usuario",
                "Usuario (opcional)",
                { autoComplete: "off", autoCapitalize: "none", spellCheck: false, placeholder: "leo" },
                "Para entrar sin escribir el email.",
              )}
              {campo("puesto", "Puesto (opcional)", { autoComplete: "off", placeholder: "Facturación y pedidos" })}
              <div className="space-y-2">
                <Label htmlFor={`${id}-rol`}>Rol</Label>
                <NativeSelect
                  id={`${id}-rol`}
                  value={rol}
                  onChange={(event) => setRol(event.target.value as Role)}
                  aria-describedby={`${id}-rol-desc`}
                >
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ROL[value]}
                    </option>
                  ))}
                </NativeSelect>
                <p id={`${id}-rol-desc`} className="text-[13px] text-muted-foreground">
                  {DESCRIPCION_ROL[rol]}
                </p>
              </div>
              {general && (
                <p role="alert" className="text-[13px] font-medium text-danger">
                  {general}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <UserPlus />}
                {pending ? "Creando…" : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
