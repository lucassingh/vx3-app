import { Inbox } from "lucide-react";
import Link from "next/link";
import { PageBody } from "@/components/layout/page-header";
import {
  ContrasteCard,
  FacturablesList,
  FacturablesListSkeleton,
  FacturasCard,
  FacturasCardSkeleton,
} from "@/components/pedidos/facturacion";
import { RouteHeader } from "@/components/pedidos/route-header";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/pedidos/facturacion";

export const metadata = getRouteMetadata(HREF);

/** M5 · Facturar es revisar y confirmar (RF-M5-02 a RF-M5-05). */
export default async function Page() {
  await requirePageAccess("/pedidos/facturacion");
  return (
    <>
      <RouteHeader
        href={HREF}
        actions={
          <Button variant="outline" asChild>
            <Link href="/pedidos/bandeja">
              <Inbox />
              Ver la bandeja
            </Link>
          </Button>
        }
      />
      <PageBody>
        <ContrasteCard />
        <section aria-labelledby="facturar-title" className="space-y-3">
          <div>
            <h2 id="facturar-title" className="text-[15px] font-semibold tracking-tight">
              Para facturar
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Ventanas de facturación: de 9 a 11 y después cada 30 a 45 minutos. Al facturar sale el remito de armado a
              la cola de impresión.
            </p>
          </div>
          <AsyncWidget title="los pedidos para facturar" fallback={<FacturablesListSkeleton />}>
            <FacturablesList />
          </AsyncWidget>
        </section>
        <AsyncWidget title="los comprobantes emitidos" fallback={<FacturasCardSkeleton />}>
          <FacturasCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
