import { WandSparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  CatalogoKpis,
  CatalogoKpisSkeleton,
  CatalogoProductos,
  CatalogoProductosCard,
  CatalogoProductosCardSkeleton,
  CatalogoProductosSkeleton,
} from "@/components/productos/catalogo-widgets";
import { ProductoFromParams } from "@/components/productos/producto-detalle";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/productos/catalogo";

export const metadata = getRouteMetadata(HREF);

/**
 * M1 · Catálogo maestro: el producto armado desde el Sheet, Drive y DUX. Hasta el pase es de
 * consulta (`solucion_doc/06` §6.2): el alta y el control final vuelven con la 1.9.
 */
export default async function CatalogoPage({ searchParams }: PageProps<"/productos/catalogo">) {
  await requirePageAccess("/productos/catalogo");
  const route = findRoute(HREF);

  return (
    <>
      <PageHeader
        eyebrow={route?.group?.title}
        title={route?.link.title ?? "Catálogo"}
        description={route?.link.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/productos/combos">
              <WandSparkles />
              Combos y flyers
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AsyncWidget title="los indicadores del catálogo" fallback={<CatalogoKpisSkeleton />}>
          <CatalogoKpis />
        </AsyncWidget>

        <AsyncWidget title="los productos" fallback={<CatalogoProductosCardSkeleton />}>
          <CatalogoProductosCard searchParams={searchParams}>
            <AsyncWidget
              title="los productos"
              className="rounded-none border-x-0 border-b-0 shadow-none"
              fallback={<CatalogoProductosSkeleton />}
            >
              <CatalogoProductos searchParams={searchParams} />
            </AsyncWidget>
          </CatalogoProductosCard>
        </AsyncWidget>

        <Suspense fallback={null}>
          <ProductoFromParams searchParams={searchParams} basePath={HREF} />
        </Suspense>
      </PageBody>
    </>
  );
}
