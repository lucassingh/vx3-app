import { Check, Eye, Minus, ShieldCheck, ShieldOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonText, TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { AuditoriaEntry, NivelPermiso } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { matrizDePermisos } from "@/modules/platform/permissions";
import { AuditoriaList, type AuditoriaRow } from "./auditoria-list";
import { cuando, ROL } from "./shared";

/** Filas del registro con la fecha formateada en el servidor. */
export function toAuditoriaRows(entries: AuditoriaEntry[]): AuditoriaRow[] {
  return entries.map((entry) => ({ ...entry, cuando: cuando(entry.en) }));
}

/* ---- Equipo ----------------------------------------------------------------- */

const EQUIPO_COLUMNS = ["Persona", "Rol", "Último acceso", "Verificación en dos pasos"];

function EquipoFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>Cada persona con su usuario: así el registro sabe quién hizo cada cosa</CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function EquipoCard() {
  const usuarios = await api.plataforma.usuarios.list();

  return (
    <EquipoFrame>
      <Table className="min-w-2xl">
        <TableHeader>
          <TableRow>
            {EQUIPO_COLUMNS.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar name={usuario.nombre} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {usuario.nombre}
                      {usuario.estado === "invitado" && (
                        <Badge variant="warning" dot>
                          Invitación pendiente
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {usuario.puesto}
                      {usuario.email && ` · ${usuario.email}`}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={usuario.rol === "admin" ? "primary" : "outline"}>{ROL[usuario.rol]}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground first-letter:uppercase">
                {usuario.ultimoAcceso ? (
                  <time dateTime={usuario.ultimoAcceso}>{cuando(usuario.ultimoAcceso)}</time>
                ) : (
                  "Nunca"
                )}
              </TableCell>
              <TableCell>
                {usuario.dosFactores ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-success">
                    <ShieldCheck aria-hidden className="size-4" />
                    Activada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ShieldOff aria-hidden className="size-4" />
                    Sin activar
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EquipoFrame>
  );
}

export function EquipoSkeleton() {
  return (
    <EquipoFrame>
      <LoadingLabel>Cargando equipo…</LoadingLabel>
      <TableSkeleton columns={EQUIPO_COLUMNS} rows={5} className="min-w-2xl" />
    </EquipoFrame>
  );
}

/* ---- Roles y permisos ------------------------------------------------------- */

const NIVEL: Record<NivelPermiso, { label: string; icon: typeof Check; className: string }> = {
  edita: { label: "Edita", icon: Check, className: "text-success" },
  ve: { label: "Solo ve", icon: Eye, className: "text-muted-foreground" },
  no: { label: "Sin acceso", icon: Minus, className: "text-border-strong" },
};

function RolesFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Roles y permisos</CardTitle>
          <CardDescription>
            Toda acción que mueve plata, stock o una regla queda en el registro, sea del rol que sea
          </CardDescription>
        </div>
        <ul
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
          aria-label="Referencias"
        >
          {(Object.keys(NIVEL) as NivelPermiso[]).map((nivel) => {
            const { label, icon: Icon, className } = NIVEL[nivel];
            return (
              <li key={nivel} className="inline-flex items-center gap-1.5">
                <Icon aria-hidden className={cn("size-3.5", className)} />
                {label}
              </li>
            );
          })}
        </ul>
      </CardHeader>
      {children}
    </Card>
  );
}

export function RolesCard() {
  const { roles, areas } = matrizDePermisos();

  return (
    <RolesFrame>
      <Table className="min-w-3xl">
        <TableHeader>
          <TableRow>
            <TableHead>Área</TableHead>
            {roles.map((rol) => (
              <TableHead key={rol.id} className="text-center">
                <span className="block text-foreground">{rol.nombre}</span>
                <span className="block font-normal">{rol.quien}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {areas.map((area) => (
            <TableRow key={area.id}>
              <TableCell className="font-medium">{area.nombre}</TableCell>
              {roles.map((rol) => {
                const { label, icon: Icon, className } = NIVEL[area.permisos[rol.id]];
                return (
                  <TableCell key={rol.id} className="text-center">
                    <Icon aria-hidden className={cn("mx-auto size-4", className)} />
                    <span className="sr-only">
                      {rol.nombre}: {label}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </RolesFrame>
  );
}

export function RolesSkeleton() {
  return (
    <RolesFrame>
      <LoadingLabel>Cargando permisos…</LoadingLabel>
      <TableSkeleton columns={["Área", ...Object.values(ROL)]} rows={6} className="min-w-3xl" />
    </RolesFrame>
  );
}

/* ---- Auditoría -------------------------------------------------------------- */

function AuditoriaFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function AuditoriaCard() {
  const entries = await api.plataforma.auditoria.list();
  return (
    <AuditoriaFrame
      title="Registro de auditoría"
      description="Quién hizo qué y cuándo, con el valor anterior y el nuevo"
    >
      <AuditoriaList rows={toAuditoriaRows(entries)} />
    </AuditoriaFrame>
  );
}

export function AuditoriaSkeleton({ title = "Registro de auditoría" }: { title?: string }) {
  return (
    <AuditoriaFrame title={title} description="Quién hizo qué y cuándo, con el valor anterior y el nuevo">
      <LoadingLabel>Cargando registro…</LoadingLabel>
      <SkeletonText lines={6} />
    </AuditoriaFrame>
  );
}

/** Actividad de un usuario (la usa Mi perfil). */
export async function ActividadCard({ usuarioId }: { usuarioId: string }) {
  const entries = await api.plataforma.auditoria.list({ usuario: usuarioId });
  return (
    <AuditoriaFrame
      title="Tu actividad reciente"
      description="Lo último que hiciste en la app, tal como queda en el registro"
    >
      <AuditoriaList rows={toAuditoriaRows(entries.slice(0, 6))} filtros={false} />
    </AuditoriaFrame>
  );
}
