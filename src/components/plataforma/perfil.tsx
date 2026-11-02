import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { currentUser } from "@/lib/auth";
import { DatosForm, SeguridadForm, SesionesList } from "./perfil-forms";
import { cuando } from "./shared";

export function DatosCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={currentUser.name} src={currentUser.avatarUrl} className="size-14 text-base" />
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{currentUser.name}</CardTitle>
            <CardDescription className="truncate">{currentUser.email}</CardDescription>
            <Badge variant="primary">{currentUser.role}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <DatosForm />
      </CardContent>
    </Card>
  );
}

function SeguridadFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Seguridad</CardTitle>
          <CardDescription>Tu contraseña y la verificación en dos pasos</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function SeguridadCard() {
  const seguridad = await api.plataforma.perfil.seguridad();
  return (
    <SeguridadFrame>
      <SeguridadForm dosFactores={seguridad.dosFactores} passwordLabel={cuando(seguridad.passwordActualizada)} />
    </SeguridadFrame>
  );
}

export function SeguridadSkeleton() {
  return (
    <SeguridadFrame>
      <LoadingLabel>Cargando seguridad…</LoadingLabel>
      <SkeletonText lines={6} />
    </SeguridadFrame>
  );
}

function SesionesFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sesiones abiertas</CardTitle>
          <CardDescription>Dónde está abierta tu cuenta. Cerrá las que no reconozcas.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function SesionesCard() {
  const sesiones = await api.plataforma.perfil.sesiones();
  return (
    <SesionesFrame>
      <SesionesList
        initial={sesiones.map((sesion) => ({
          id: sesion.id,
          dispositivo: sesion.dispositivo,
          navegador: sesion.navegador,
          ubicacion: sesion.ubicacion,
          cuando: cuando(sesion.ultimaActividad),
          actual: sesion.actual,
        }))}
      />
    </SesionesFrame>
  );
}

export function SesionesSkeleton() {
  return (
    <SesionesFrame>
      <LoadingLabel>Cargando sesiones…</LoadingLabel>
      <SkeletonText lines={3} />
    </SesionesFrame>
  );
}
