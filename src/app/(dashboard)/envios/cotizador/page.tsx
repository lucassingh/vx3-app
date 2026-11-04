import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { CotizadorForm } from "@/components/envios/cotizador-form";
import { PageBody } from "@/components/layout/page-header";
import { RouteHeader } from "@/components/pedidos/route-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncWidget } from "@/components/views/async-widget";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/envios/cotizador";

export const metadata = getRouteMetadata(HREF);

async function Cotizador() {
  const opciones = await api.envios.opcionesCotizador();
  return <CotizadorForm opciones={opciones} />;
}

function CotizadorSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {[0, 1].map((index) => (
        <Card key={index}>
          <CardHeader>
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <SkeletonText lines={7} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** M6 · Cotizador propio: arma los bultos y cotiza bulto por bulto (RF-M6-01, 03, 09). */
export default async function Page() {
  await requirePageAccess("/envios/cotizador");
  return (
    <>
      <RouteHeader
        href={HREF}
        actions={
          <Button variant="outline" asChild>
            <Link href="/envios/despacho">
              <PackageCheck />
              Despacho del día
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="el cotizador" fallback={<CotizadorSkeleton />}>
          <Cotizador />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
