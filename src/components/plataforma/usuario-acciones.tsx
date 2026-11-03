"use client";

import { KeyRound, LoaderCircle, LogOut, MoreHorizontal, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Result } from "@/lib/result";
import { toast } from "@/lib/toast";
import { isRole, type Role, ROLES } from "@/modules/platform/permissions";
import {
  cambiarRol,
  cerrarSesiones,
  desactivarUsuario,
  reactivarUsuario,
  resetearPassword,
} from "@/modules/platform/users/actions";
import type { UsuarioFila } from "@/modules/platform/users/service";
import { PasswordTemporal } from "./password-temporal";
import { ROL } from "./shared";

type Confirmacion = "desactivar" | "resetear" | "sesiones";

const CONFIRMACION: Record<Confirmacion, { titulo: string; texto: string; boton: string; peligro: boolean }> = {
  desactivar: {
    titulo: "Desactivar a {nombre}",
    texto:
      "No va a poder entrar y se cierran sus sesiones abiertas. Su historial queda en el registro. Lo podés reactivar cuando quieras.",
    boton: "Desactivar",
    peligro: true,
  },
  resetear: {
    titulo: "Resetear la contraseña de {nombre}",
    texto:
      "Su contraseña actual deja de andar y se cierran sus sesiones. Te mostramos una temporal para que se la pases.",
    boton: "Resetear",
    peligro: true,
  },
  sesiones: {
    titulo: "Cerrar las sesiones de {nombre}",
    texto:
      "Se cierra en todos sus dispositivos (por ejemplo, si perdió el celular). Puede volver a entrar con su contraseña.",
    boton: "Cerrar sesiones",
    peligro: false,
  },
};

/** Menú de acciones de cada persona en la tabla del equipo (solo admin; nunca sobre uno mismo). */
export function UsuarioAcciones({ usuario }: { usuario: UsuarioFila }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
  const [passwordNueva, setPasswordNueva] = useState<string | null>(null);
  const primerNombre = usuario.nombre.split(" ")[0] ?? usuario.nombre;

  const ejecutar = <T,>(accion: () => Promise<Result<T>>, exito: string, despues?: (data: T) => void) => {
    startTransition(async () => {
      const result = await accion();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(exito);
      despues?.(result.data);
      router.refresh();
    });
  };

  const onRol = (valor: string) => {
    if (!isRole(valor) || valor === usuario.rol) return;
    ejecutar(() => cambiarRol({ userId: usuario.id, rol: valor }), `${primerNombre} ahora es ${ROL[valor]}`);
  };

  const onConfirmar = () => {
    const userId = usuario.id;
    if (confirmar === "desactivar") {
      ejecutar(
        () => desactivarUsuario({ userId }),
        `${primerNombre} quedó desactivado`,
        () => setConfirmar(null),
      );
    } else if (confirmar === "sesiones") {
      ejecutar(
        () => cerrarSesiones({ userId }),
        `Se cerraron las sesiones de ${primerNombre}`,
        () => setConfirmar(null),
      );
    } else if (confirmar === "resetear") {
      ejecutar(
        () => resetearPassword({ userId }),
        `Contraseña de ${primerNombre} reseteada`,
        ({ passwordTemporal }) => {
          setConfirmar(null);
          setPasswordNueva(passwordTemporal);
        },
      );
    }
  };

  const desactivado = usuario.estado === "desactivado";
  const textos = confirmar ? CONFIRMACION[confirmar] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones para ${usuario.nombre}`} disabled={pending}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <MoreHorizontal aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="truncate">{usuario.nombre}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {desactivado ? (
            <DropdownMenuItem
              onSelect={() =>
                ejecutar(() => reactivarUsuario({ userId: usuario.id }), `${primerNombre} puede volver a entrar`)
              }
            >
              <UserCheck aria-hidden />
              Reactivar
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ShieldCheck aria-hidden />
                  Cambiar rol
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={usuario.rol} onValueChange={onRol}>
                    {ROLES.map((rol: Role) => (
                      <DropdownMenuRadioItem key={rol} value={rol}>
                        {ROL[rol]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => setConfirmar("resetear")}>
                <KeyRound aria-hidden />
                Resetear contraseña
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmar("sesiones")}>
                <LogOut aria-hidden />
                Cerrar sesiones
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirmar("desactivar")} className="text-danger">
                <UserX aria-hidden />
                Desactivar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmar !== null} onOpenChange={(abierto) => !abierto && !pending && setConfirmar(null)}>
        <DialogContent>
          {textos && (
            <div className="flex min-h-0 flex-col">
              <DialogHeader>
                <DialogTitle>{textos.titulo.replace("{nombre}", primerNombre)}</DialogTitle>
                <DialogDescription>{textos.texto}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmar(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant={textos.peligro ? "danger" : "primary"}
                  onClick={onConfirmar}
                  disabled={pending}
                >
                  {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                  {textos.boton}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={passwordNueva !== null} onOpenChange={(abierto) => !abierto && setPasswordNueva(null)}>
        <DialogContent>
          <div className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Nueva contraseña temporal de {primerNombre}</DialogTitle>
              <DialogDescription>Su contraseña anterior ya no anda y sus sesiones se cerraron.</DialogDescription>
            </DialogHeader>
            <DialogBody>{passwordNueva && <PasswordTemporal password={passwordNueva} />}</DialogBody>
            <DialogFooter>
              <Button type="button" onClick={() => setPasswordNueva(null)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
