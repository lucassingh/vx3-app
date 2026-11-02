import { Factory } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  HistorialCard,
  HistorialCardSkeleton,
  RecepcionLoader,
  RecepcionSkeleton,
} from "@/components/stock/compras-widgets";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/stock/compras";

export const metadata = getRouteMetadata(HREF);

/** M2 · Recepción de compra digital y carga en DUX por API (RF-M2-02, RF-M2-03, RF-M2-08). */
export default function ComprasPage() {
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Compras"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/stock/proveedores">
              <Factory />
              Proveedores
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="la recepción en curso" fallback={<RecepcionSkeleton />}>
          <RecepcionLoader />
        </AsyncWidget>

        <AsyncWidget title="el historial de compras" fallback={<HistorialCardSkeleton />}>
          <HistorialCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
