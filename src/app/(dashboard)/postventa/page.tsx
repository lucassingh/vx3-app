import { PageBody } from "@/components/layout/page-header";
import { RouteHeader } from "@/components/pedidos/route-header";
import { PostventaSkeleton, PostventaView } from "@/components/postventa/postventa";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/postventa";

export const metadata = getRouteMetadata(HREF);

/** M8 · Post-venta: reclamo, evidencia, resolución, nota de crédito y causa (RF-M8-01 a RF-M8-06). */
export default async function Page() {
  await requirePageAccess("/postventa");
  return (
    <>
      <RouteHeader href={HREF} />
      <PageBody>
        <AsyncWidget title="los reclamos" fallback={<PostventaSkeleton />}>
          <PostventaView />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
