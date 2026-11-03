import { History } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  HistorialReglas,
  HistorialReglasSkeleton,
  ReglasEditorCard,
  ReglasEditorSkeleton,
  ReglasResumen,
  ReglasResumenSkeleton,
} from "@/components/plataforma/reglas";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/configuracion/reglas";

export const metadata = getRouteMetadata(HREF);

/** RF-M0-02 · Editor de reglas de negocio: las ⚙️ del catálogo (solucion_doc/02). */
export default async function ReglasPage() {
  await requirePageAccess("/configuracion/reglas");
  const { link } = findRoute(HREF)!;

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title={link.title}
        description={link.description}
        actions={
          <Button variant="outline" asChild>
            <a href="#historial">
              <History />
              Historial de cambios
            </a>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="el resumen de las reglas" fallback={<ReglasResumenSkeleton />}>
          <ReglasResumen />
        </AsyncWidget>
        <AsyncWidget title="las reglas" fallback={<ReglasEditorSkeleton />}>
          <ReglasEditorCard />
        </AsyncWidget>
        <AsyncWidget title="el historial" fallback={<HistorialReglasSkeleton />}>
          <HistorialReglas />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
