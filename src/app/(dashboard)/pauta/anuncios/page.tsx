import { Wallet } from "lucide-react";
import Link from "next/link";
import { routeHeader, type SearchParams } from "@/components/clientas/shared";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  AnunciosCard,
  AnunciosCardSkeleton,
  AtribucionCard,
  AtribucionCardSkeleton,
  ConfigCardSkeleton,
  ConversionesCard,
  PautaKpis,
  PautaKpisSkeleton,
  TipoCambioCard,
} from "@/components/pauta/anuncios";
import { PeriodoToggle } from "@/components/pauta/periodo-toggle";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";

const HREF = "/pauta/anuncios";

export const metadata = getRouteMetadata(HREF);

/** M9 · RM por anuncio con ventas verificadas y margen real (RF-M9-01 a 11). */
export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const header = routeHeader(HREF);

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
        actions={
          <>
            <PeriodoToggle />
            <Button variant="outline" asChild>
              <Link href="/pauta/presupuesto">
                <Wallet />
                Presupuesto
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="los indicadores de la pauta" fallback={<PautaKpisSkeleton />}>
          <PautaKpis searchParams={searchParams} />
        </AsyncWidget>

        <AsyncWidget title="los anuncios" fallback={<AnunciosCardSkeleton />}>
          <AnunciosCard searchParams={searchParams} />
        </AsyncWidget>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <AsyncWidget title="la atribución" fallback={<AtribucionCardSkeleton />}>
            <AtribucionCard searchParams={searchParams} />
          </AsyncWidget>
          <AsyncWidget title="el tipo de cambio" fallback={<ConfigCardSkeleton title="Tipo de cambio" />}>
            <TipoCambioCard />
          </AsyncWidget>
          <AsyncWidget title="el envío de ventas a Meta" fallback={<ConfigCardSkeleton title="Ventas devueltas a Meta" />}>
            <ConversionesCard />
          </AsyncWidget>
        </div>
      </PageBody>
    </>
  );
}
