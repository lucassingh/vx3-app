import { Repeat } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DuplicadosCard, DuplicadosCardSkeleton } from "@/components/clientas/duplicados";
import { FichaFromParams } from "@/components/clientas/ficha";
import { ClientasCard, SegmentosResumen, SegmentosResumenSkeleton } from "@/components/clientas/fichas";
import { routeHeader, type SearchParams } from "@/components/clientas/shared";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/clientas/fichas";

export const metadata = getRouteMetadata(HREF);

/** M12 · Ficha única de clienta por teléfono normalizado (RF-M12-01 a 03). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePageAccess("/clientas/fichas");
  const header = routeHeader(HREF);

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        actions={
          <Button asChild>
            <Link href="/clientas/recompra">
              <Repeat />
              Recompra del día
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="los segmentos" fallback={<SegmentosResumenSkeleton />}>
          <SegmentosResumen searchParams={searchParams} />
        </AsyncWidget>

        <ClientasCard searchParams={searchParams} />

        <AsyncWidget title="las fichas unificadas" fallback={<DuplicadosCardSkeleton />}>
          <DuplicadosCard />
        </AsyncWidget>

        <Suspense fallback={null}>
          <FichaFromParams searchParams={searchParams} basePath={HREF} />
        </Suspense>
      </PageBody>
    </>
  );
}
