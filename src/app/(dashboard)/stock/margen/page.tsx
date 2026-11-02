import { Warehouse } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  BajoPisoCard,
  BajoPisoCardSkeleton,
  CapasCard,
  CapasCardSkeleton,
  CoeficientesCard,
  CoeficientesCardSkeleton,
  EtiquetasLoader,
  MargenKpis,
  MargenKpisSkeleton,
} from "@/components/stock/margen-widgets";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { CardSkeleton } from "@/components/views/skeletons";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/stock/margen";

export const metadata = getRouteMetadata(HREF);

/** M2 · Control de margen diario, capas de costo y etiquetas (RF-M2-04 a RF-M2-07). */
export default function MargenPage() {
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Margen y precios"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/stock/espejo">
              <Warehouse />
              Ver stock
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="los indicadores de margen" fallback={<MargenKpisSkeleton />}>
          <MargenKpis />
        </AsyncWidget>

        <AsyncWidget title="los productos bajo el piso" fallback={<BajoPisoCardSkeleton />}>
          <BajoPisoCard />
        </AsyncWidget>

        <div className="grid gap-6 xl:grid-cols-2">
          <AsyncWidget title="las capas de costo" fallback={<CapasCardSkeleton />}>
            <CapasCard />
          </AsyncWidget>
          <div className="space-y-6">
            <AsyncWidget title="los coeficientes" fallback={<CoeficientesCardSkeleton />}>
              <CoeficientesCard />
            </AsyncWidget>
            <AsyncWidget title="las etiquetas" fallback={<CardSkeleton />}>
              <EtiquetasLoader />
            </AsyncWidget>
          </div>
        </div>
      </PageBody>
    </>
  );
}
