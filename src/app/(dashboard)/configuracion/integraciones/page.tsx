import { PlugZap } from "lucide-react";
import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  IntegracionesGrid,
  IntegracionesGridSkeleton,
  IntegracionesResumen,
  IntegracionesResumenSkeleton,
  ProbarTodasLoader,
  SyncLog,
  SyncLogSkeleton,
} from "@/components/plataforma/integraciones";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/configuracion/integraciones";

export const metadata = getRouteMetadata(HREF);

/** RF-M0-04 y RF-M0-06 · Panel de integraciones y credenciales de las cuentas de VX3. */
export default async function IntegracionesPage() {
  await requirePageAccess("/configuracion/integraciones");
  const { link } = findRoute(HREF)!;

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title={link.title}
        description={link.description}
        actions={
          <Suspense
            fallback={
              <Button variant="outline" disabled>
                <PlugZap />
                Probar todas
              </Button>
            }
          >
            <ProbarTodasLoader />
          </Suspense>
        }
      />
      <PageBody>
        <AsyncWidget title="el estado de las integraciones" fallback={<IntegracionesResumenSkeleton />}>
          <IntegracionesResumen />
        </AsyncWidget>
        <AsyncWidget title="las integraciones" fallback={<IntegracionesGridSkeleton />}>
          <IntegracionesGrid />
        </AsyncWidget>
        <AsyncWidget title="el registro de sincronizaciones" fallback={<SyncLogSkeleton />}>
          <SyncLog />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
