import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { CombosGenerador } from "@/components/productos/combos-generador";
import { Button } from "@/components/ui/button";
import { LoadingLabel } from "@/components/ui/skeleton";
import { AsyncWidget } from "@/components/views/async-widget";
import { CardSkeleton, SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/productos/combos";

export const metadata = getRouteMetadata(HREF);

async function CombosLoader() {
  const [facetas, inicial] = await Promise.all([api.catalogo.facetas(), api.catalogo.combos({ modo: "margen" })]);
  return <CombosGenerador rubros={facetas.rubros} inicial={inicial} />;
}

function CombosSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingLabel>Cargando combos…</LoadingLabel>
      <CardSkeleton>
        <SkeletonText lines={3} />
      </CardSkeleton>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <CardSkeleton key={index}>
              <SkeletonText lines={5} />
            </CardSkeleton>
          ))}
        </div>
        <CardSkeleton>
          <SkeletonText lines={8} />
        </CardSkeleton>
      </div>
    </div>
  );
}

/** M2 · Generador de combos sugeridos (RF-M2-13) y flyers (RF-M1-17). Reemplaza los del Hub. */
export default function CombosPage() {
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Combos y flyers"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/productos/catalogo">
              <LayoutGrid />
              Ver catálogo
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="los combos" fallback={<CombosSkeleton />}>
          <CombosLoader />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
