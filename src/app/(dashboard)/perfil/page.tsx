import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  DatosCard,
  SeguridadCard,
  SeguridadSkeleton,
  SesionesCard,
  SesionesSkeleton,
} from "@/components/plataforma/perfil";
import { ActividadCard, AuditoriaSkeleton } from "@/components/plataforma/usuarios";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/perfil";

export const metadata = getRouteMetadata(HREF);

/** Mi perfil: datos, acceso, sesiones y actividad del usuario. */
export default async function PerfilPage() {
  await requirePageAccess("/perfil");
  const { link } = findRoute(HREF)!;

  return (
    <>
      <PageHeader eyebrow="Cuenta" title={link.title} description={link.description} />
      <PageBody>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <DatosCard />
          <AsyncWidget title="la seguridad de tu cuenta" fallback={<SeguridadSkeleton />}>
            <SeguridadCard />
          </AsyncWidget>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <AsyncWidget title="tus sesiones" fallback={<SesionesSkeleton />}>
            <SesionesCard />
          </AsyncWidget>
          <AsyncWidget title="tu actividad" fallback={<AuditoriaSkeleton title="Tu actividad reciente" />}>
            <ActividadCard />
          </AsyncWidget>
        </div>
      </PageBody>
    </>
  );
}
