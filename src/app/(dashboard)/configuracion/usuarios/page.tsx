import { PageBody, PageHeader } from "@/components/layout/page-header";
import { InvitarUsuario } from "@/components/plataforma/invitar-usuario";
import {
  AuditoriaCard,
  AuditoriaSkeleton,
  EquipoCard,
  EquipoSkeleton,
  RolesCard,
  RolesSkeleton,
} from "@/components/plataforma/usuarios";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/configuracion/usuarios";

export const metadata = getRouteMetadata(HREF);

/** RF-M0-01 y RF-M0-03 · Usuarios, roles (06 §4) y registro de auditoría. */
export default function UsuariosPage() {
  const { link } = findRoute(HREF)!;

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title={link.title}
        description={link.description}
        actions={<InvitarUsuario />}
      />
      <PageBody>
        <AsyncWidget title="el equipo" fallback={<EquipoSkeleton />}>
          <EquipoCard />
        </AsyncWidget>
        <AsyncWidget title="los permisos" fallback={<RolesSkeleton />}>
          <RolesCard />
        </AsyncWidget>
        <AsyncWidget title="el registro de auditoría" fallback={<AuditoriaSkeleton />}>
          <AuditoriaCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
