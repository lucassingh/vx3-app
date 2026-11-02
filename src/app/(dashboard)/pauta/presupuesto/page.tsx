import { Target } from "lucide-react";
import Link from "next/link";
import { routeHeader } from "@/components/clientas/shared";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  CampanasCard,
  CampanasCardSkeleton,
  GastoDiarioCard,
  GastoDiarioCardSkeleton,
  PresupuestoKpis,
  PresupuestoKpisSkeleton,
} from "@/components/pauta/presupuesto";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";

const HREF = "/pauta/presupuesto";

export const metadata = getRouteMetadata(HREF);

/** M9 · Presupuesto planificado por campaña y desvío contra el gasto real (RF-M9-02). */
export default function Page() {
  const header = routeHeader(HREF);

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/pauta/anuncios">
              <Target />
              Anuncios y RM
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="el presupuesto del mes" fallback={<PresupuestoKpisSkeleton />}>
          <PresupuestoKpis />
        </AsyncWidget>

        <AsyncWidget title="las campañas" fallback={<CampanasCardSkeleton />}>
          <CampanasCard />
        </AsyncWidget>

        <AsyncWidget title="el gasto diario" fallback={<GastoDiarioCardSkeleton />}>
          <GastoDiarioCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
