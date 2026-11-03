import { ConciliacionSkeleton, ConciliacionView } from "@/components/cobros/conciliacion";
import { PageBody } from "@/components/layout/page-header";
import { RouteHeader } from "@/components/pedidos/route-header";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/cobros/conciliacion";

export const metadata = getRouteMetadata(HREF);

/** M7 · La app propone cada cruce pago ↔ venta; la persona confirma (RF-M7-01 a RF-M7-05). */
export default async function Page() {
  await requirePageAccess("/cobros/conciliacion");
  return (
    <>
      <RouteHeader href={HREF} />
      <PageBody>
        <AsyncWidget title="la conciliación" fallback={<ConciliacionSkeleton />}>
          <ConciliacionView />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
