import { Activity } from "lucide-react";
import Link from "next/link";
import { ConfigLoader, ConfigSkeleton } from "@/components/bot/config-loader";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/bot/configuracion";

export const metadata = getRouteMetadata(HREF);

/** M3 · Consola del bot: lo configuran los socios, con versiones y chat de prueba. */
export default async function BotConfiguracionPage() {
  await requirePageAccess("/bot/configuracion");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Configuración"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/bot/rendimiento">
              <Activity />
              Ver rendimiento
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="la configuración del bot" fallback={<ConfigSkeleton />}>
          <ConfigLoader />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
