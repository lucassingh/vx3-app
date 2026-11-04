import { MessagesSquare, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import {
  BacklogCard,
  BacklogSkeleton,
  BotKpis,
  BotKpisSkeleton,
  DerivacionesCard,
  DerivacionesSkeleton,
  PuestaEnMarchaCard,
  PuestaEnMarchaSkeleton,
  RecorridosCard,
  RecorridosSkeleton,
  RespuestasCard,
  RespuestasSkeleton,
} from "@/components/bot/rendimiento";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/bot/rendimiento";

export const metadata = getRouteMetadata(HREF);

/** M3 · Rendimiento del bot: acierto, derivaciones, costo y visor de respuestas. */
export default async function BotRendimientoPage() {
  await requirePageAccess("/bot/rendimiento");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Rendimiento"}
        description={route?.link.description}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/conversaciones">
                <MessagesSquare />
                Ver conversaciones
              </Link>
            </Button>
            <Button asChild>
              <Link href="/bot/configuracion">
                <SlidersHorizontal />
                Configurar el bot
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="los indicadores del bot" fallback={<BotKpisSkeleton />}>
          <BotKpis />
        </AsyncWidget>

        <div className="grid gap-6 xl:grid-cols-3">
          <AsyncWidget title="la puesta en marcha" className="xl:col-span-2" fallback={<PuestaEnMarchaSkeleton />}>
            <PuestaEnMarchaCard />
          </AsyncWidget>
          <AsyncWidget title="las derivaciones" fallback={<DerivacionesSkeleton />}>
            <DerivacionesCard />
          </AsyncWidget>
        </div>

        <AsyncWidget title="los recorridos" fallback={<RecorridosSkeleton />}>
          <RecorridosCard />
        </AsyncWidget>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <AsyncWidget title="las respuestas recientes" fallback={<RespuestasSkeleton />}>
            <RespuestasCard />
          </AsyncWidget>
          <AsyncWidget title="los criterios de aceptación" fallback={<BacklogSkeleton />}>
            <BacklogCard />
          </AsyncWidget>
        </div>
      </PageBody>
    </>
  );
}
