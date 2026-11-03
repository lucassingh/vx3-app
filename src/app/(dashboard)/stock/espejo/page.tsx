import { ClipboardList, Percent } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  DiferenciasCard,
  DiferenciasCardSkeleton,
  StockKpis,
  StockKpisSkeleton,
  StockTabla,
  StockTablaCard,
  StockTablaCardSkeleton,
  StockTablaSkeleton,
  SyncCard,
  SyncCardSkeleton,
} from "@/components/stock/espejo-widgets";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/stock/espejo";

export const metadata = getRouteMetadata(HREF);

/** M2 · Espejo del stock y los precios de DUX (RF-M2-01, RF-M2-09, RF-M2-12). */
export default async function StockPage({ searchParams }: PageProps<"/stock/espejo">) {
  await requirePageAccess("/stock/espejo");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Stock"}
        description={route?.link.description}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/stock/margen">
                <Percent />
                Margen y precios
              </Link>
            </Button>
            <Button asChild>
              <Link href="/stock/compras">
                <ClipboardList />
                Recibir mercadería
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="el estado de la sincronización" fallback={<SyncCardSkeleton />}>
          <SyncCard />
        </AsyncWidget>

        <AsyncWidget title="los indicadores de stock" fallback={<StockKpisSkeleton />}>
          <StockKpis />
        </AsyncWidget>

        <AsyncWidget title="el stock" fallback={<StockTablaCardSkeleton />}>
          <StockTablaCard>
            <AsyncWidget
              title="el stock"
              className="rounded-none border-x-0 border-b-0 shadow-none"
              fallback={<StockTablaSkeleton />}
            >
              <StockTabla searchParams={searchParams} />
            </AsyncWidget>
          </StockTablaCard>
        </AsyncWidget>

        <AsyncWidget title="las diferencias en góndola" fallback={<DiferenciasCardSkeleton />}>
          <DiferenciasCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
