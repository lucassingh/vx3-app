import { Calculator } from "lucide-react";
import Link from "next/link";
import {
  DespachoGrupos,
  DespachoGruposSkeleton,
  DesviosCard,
  DesviosCardSkeleton,
} from "@/components/envios/despacho";
import { PageBody } from "@/components/layout/page-header";
import { RouteHeader } from "@/components/pedidos/route-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";

const HREF = "/envios/despacho";

export const metadata = getRouteMetadata(HREF);

/** M6 · Despacho del día por transportista, con los cortes horarios (RN-80). */
export default function Page() {
  return (
    <>
      <RouteHeader
        href={HREF}
        actions={
          <Button variant="outline" asChild>
            <Link href="/envios/cotizador">
              <Calculator />
              Cotizar un envío
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="el despacho del día" fallback={<DespachoGruposSkeleton />}>
          <DespachoGrupos />
        </AsyncWidget>
        <AsyncWidget title="los desvíos" fallback={<DesviosCardSkeleton />}>
          <DesviosCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
