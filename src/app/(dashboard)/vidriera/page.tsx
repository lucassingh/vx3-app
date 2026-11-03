import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  EmbudoVidrieraCard,
  EmbudoVidrieraSkeleton,
  VidrieraEditorLoader,
  VidrieraEditorSkeleton,
  VidrieraKpis,
  VidrieraKpisSkeleton,
  VidrieraPreviewCard,
  VidrieraPreviewSkeleton,
} from "@/components/vidriera/widgets";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/vidriera";

export const metadata = getRouteMetadata(HREF);

/** M4 · Vidriera propia: reemplaza el catálogo de DUX. */
export default async function VidrieraPage() {
  await requirePageAccess("/vidriera");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.section?.label}
        title={route?.link.title ?? "Vidriera"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/productos/catalogo">
              <LayoutGrid />
              Editar productos en el catálogo
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="los indicadores de la vidriera" fallback={<VidrieraKpisSkeleton />}>
          <VidrieraKpis />
        </AsyncWidget>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-6">
            <AsyncWidget title="el embudo" fallback={<EmbudoVidrieraSkeleton />}>
              <EmbudoVidrieraCard />
            </AsyncWidget>
            <AsyncWidget title="las colecciones" fallback={<VidrieraEditorSkeleton />}>
              <VidrieraEditorLoader />
            </AsyncWidget>
          </div>
          <div className="xl:sticky xl:top-20">
            <AsyncWidget title="la vista previa" fallback={<VidrieraPreviewSkeleton />}>
              <VidrieraPreviewCard />
            </AsyncWidget>
          </div>
        </div>
      </PageBody>
    </>
  );
}
