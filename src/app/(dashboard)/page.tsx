import { ReceiptText, Repeat } from "lucide-react";
import Link from "next/link";
import {
  CanalesCard,
  CanalesCardSkeleton,
  CausasCard,
  CausasCardSkeleton,
  EmbudoCard,
  EmbudoCardSkeleton,
  InicioKpis,
  InicioKpisSkeleton,
  OperacionCard,
  OperacionCardSkeleton,
  ReactivarCard,
  ReactivarCardSkeleton,
  TopAnunciosCard,
  TopAnunciosCardSkeleton,
  VentasCard,
  VentasCardSkeleton,
} from "@/components/inicio/widgets";
import { DuxProbeButton } from "@/components/inicio/dux-probe-button";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { TodayLabel } from "@/components/layout/today-label";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { requireUser } from "@/modules/platform/auth/session";
import { getRouteMetadata } from "@/lib/navigation";
import { primerNombre } from "@/lib/format";

export const metadata = getRouteMetadata("/");

/** M10 · Dashboard ejecutivo: qué pasó hoy, qué está trabado y dónde se pierde plata. */
export default async function HomePage() {
  const firstName = primerNombre((await requireUser()).name);

  return (
    <>
      <PageHeader
        eyebrow={<TodayLabel />}
        title={`Hola, ${firstName}`}
        description="Qué pasó hoy, qué está trabado y dónde se está perdiendo plata, con los datos de todos los sistemas cruzados por clienta y por pedido."
        actions={
          <>
            {/* PROVISORIO: prueba la API real de DUX (respuestas en la consola, F12). */}
            {process.env.NODE_ENV === "development" && <DuxProbeButton />}
            <Button variant="outline" asChild>
              <Link href="/pedidos/facturacion">
                <ReceiptText />
                Facturar
              </Link>
            </Button>
            <Button asChild>
              <Link href="/clientas/recompra">
                <Repeat />
                Recompra del día
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        {/* Cada bloque pide sus datos a la API y carga de forma independiente. Arriba, los
            números que Elías revisa los lunes (Manual v4, P-15): resultado y causas. */}
        <AsyncWidget title="el resultado de la semana" fallback={<InicioKpisSkeleton />}>
          <InicioKpis />
        </AsyncWidget>

        <AsyncWidget title="los indicadores de causa" fallback={<CausasCardSkeleton />}>
          <CausasCard />
        </AsyncWidget>

        <div className="grid gap-6 xl:grid-cols-3">
          <AsyncWidget title="las ventas" className="xl:col-span-2" fallback={<VentasCardSkeleton />}>
            <VentasCard />
          </AsyncWidget>
          <AsyncWidget title="los canales" fallback={<CanalesCardSkeleton />}>
            <CanalesCard />
          </AsyncWidget>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <AsyncWidget title="el embudo" className="xl:col-span-2" fallback={<EmbudoCardSkeleton />}>
            <EmbudoCard />
          </AsyncWidget>
          <AsyncWidget title="la operación de hoy" fallback={<OperacionCardSkeleton />}>
            <OperacionCard />
          </AsyncWidget>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AsyncWidget title="los anuncios" fallback={<TopAnunciosCardSkeleton />}>
            <TopAnunciosCard />
          </AsyncWidget>
          <AsyncWidget title="las clientas para reactivar" fallback={<ReactivarCardSkeleton />}>
            <ReactivarCard />
          </AsyncWidget>
        </div>
      </PageBody>
    </>
  );
}
