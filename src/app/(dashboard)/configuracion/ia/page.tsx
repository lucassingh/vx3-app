import { ArrowUpRight } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  AdminKeyCard,
  AdminKeySkeleton,
  GastoDiarioCard,
  GastoDiarioSkeleton,
  IaStats,
  IaStatsSkeleton,
  ModeloCard,
  ModeloSkeleton,
  PorCasoCard,
  PorCasoSkeleton,
  TopeCard,
  TopeSkeleton,
} from "@/components/plataforma/ia";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/configuracion/ia";

export const metadata = getRouteMetadata(HREF);

/** RF-M0-07 · Configuración de la IA y su consumo (rol admin). */
export default function IaPage() {
  const { link } = findRoute(HREF)!;

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title={link.title}
        description={link.description}
        actions={
          <Button variant="outline" asChild>
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
              Consola de Anthropic
              <ArrowUpRight />
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="el consumo" fallback={<IaStatsSkeleton />}>
          <IaStats />
        </AsyncWidget>

        <div className="grid gap-6 xl:grid-cols-3">
          <AsyncWidget title="el gasto diario" className="xl:col-span-2" fallback={<GastoDiarioSkeleton />}>
            <GastoDiarioCard />
          </AsyncWidget>
          <AsyncWidget title="el gasto por caso" fallback={<PorCasoSkeleton />}>
            <PorCasoCard />
          </AsyncWidget>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <AsyncWidget title="el modelo del bot" className="xl:col-span-2" fallback={<ModeloSkeleton />}>
            <ModeloCard />
          </AsyncWidget>
          <div className="grid gap-6">
            <AsyncWidget title="el tope de gasto" fallback={<TopeSkeleton />}>
              <TopeCard />
            </AsyncWidget>
            <AsyncWidget title="el reporte oficial" fallback={<AdminKeySkeleton />}>
              <AdminKeyCard />
            </AsyncWidget>
          </div>
        </div>
      </PageBody>
    </>
  );
}
