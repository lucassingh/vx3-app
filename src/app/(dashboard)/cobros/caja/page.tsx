import { CajaSkeleton, CajaView } from "@/components/cobros/caja";
import { PageBody } from "@/components/layout/page-header";
import { RouteHeader } from "@/components/pedidos/route-header";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/cobros/caja";

export const metadata = getRouteMetadata(HREF);

/** M7 · Cuánto se puede gastar hoy en mercadería (RF-M7-10, Manual v4 P-01 y P-11). */
export default async function Page() {
  await requirePageAccess("/cobros/caja");
  return (
    <>
      <RouteHeader href={HREF} />
      <PageBody>
        <AsyncWidget title="la caja del día" fallback={<CajaSkeleton />}>
          <CajaView />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
