import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { routeHeader, type SearchParams } from "@/components/clientas/shared";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  RevisionBloques,
  RevisionBloquesSkeleton,
  RevisionCasos,
  RevisionCasosSkeleton,
  RevisionDecisiones,
} from "@/components/productos/revision";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";
import { can } from "@/modules/platform/permissions";

const HREF = "/productos/revision";

export const metadata = getRouteMetadata(HREF);

/**
 * La cola de revisión del catálogo (`solucion_doc/06` §6.2). Una sola lista, que se vacía sola con
 * cada importación. Acá se decide solo lo que el Sheet no puede guardar; lo demás dice dónde se corrige.
 */
export default async function RevisionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess("/productos/revision");
  const puedeEditar = can(user.role, "catalogo.editar");
  const header = routeHeader(HREF);

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/productos/catalogo">
              <LayoutGrid />
              Ver catálogo
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <AsyncWidget title="los bloques" fallback={<RevisionBloquesSkeleton />}>
            <RevisionBloques searchParams={searchParams} />
          </AsyncWidget>
          <div className="min-w-0 space-y-4">
            <AsyncWidget title="los casos" fallback={<RevisionCasosSkeleton />}>
              <RevisionCasos searchParams={searchParams} puedeEditar={puedeEditar} />
            </AsyncWidget>
            <AsyncWidget title="lo que ya se decidió" fallback={null}>
              <RevisionDecisiones puedeEditar={puedeEditar} />
            </AsyncWidget>
          </div>
        </div>
      </PageBody>
    </>
  );
}
