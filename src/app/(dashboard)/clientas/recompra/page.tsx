import { Contact } from "lucide-react";
import Link from "next/link";
import {
  RecompraListaLoader,
  RecompraListaSkeleton,
  RecompraResultadosGrid,
  RecompraResultadosSkeleton,
} from "@/components/clientas/recompra";
import { routeHeader } from "@/components/clientas/shared";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/clientas/recompra";

export const metadata = getRouteMetadata(HREF);

/** M12 · Lista diaria de clientas para reactivar con el mensaje sugerido (RF-M12-04 y 05). */
export default async function Page() {
  await requirePageAccess("/clientas/recompra");
  const header = routeHeader(HREF);

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/clientas/fichas">
              <Contact />
              Ver fichas
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="los resultados de la recompra" fallback={<RecompraResultadosSkeleton />}>
          <RecompraResultadosGrid />
        </AsyncWidget>

        <AsyncWidget title="la lista de hoy" fallback={<RecompraListaSkeleton />}>
          <RecompraListaLoader />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
