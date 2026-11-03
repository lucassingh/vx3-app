import { PackagePlus, WandSparkles } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import {
  CatalogoKpis,
  CatalogoKpisSkeleton,
  CatalogoProductos,
  CatalogoProductosCard,
  CatalogoProductosCardSkeleton,
  CatalogoProductosSkeleton,
  ControlFinalCard,
  ControlFinalCardSkeleton,
} from "@/components/productos/catalogo-widgets";
import { Button } from "@/components/ui/button";
import { AsyncWidget } from "@/components/views/async-widget";
import { findRoute, getRouteMetadata } from "@/lib/navigation";
import { requirePageAccess } from "@/modules/platform/auth/session";

const HREF = "/productos/catalogo";

export const metadata = getRouteMetadata(HREF);

/** M1 · Catálogo maestro (PIM): la fuente única del producto. */
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
          <>
            <Button variant="outline" asChild>
              <Link href="/productos/combos">
                <WandSparkles />
                Combos y flyers
              </Link>
            </Button>
            <Button asChild>
              <Link href="/productos/alta">
                <PackagePlus />
                Nuevo producto
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="los indicadores del catálogo" fallback={<CatalogoKpisSkeleton />}>
          <CatalogoKpis />
        </AsyncWidget>

        <AsyncWidget title="el control final" fallback={<ControlFinalCardSkeleton />}>
          <ControlFinalCard />
        </AsyncWidget>

        <AsyncWidget title="los productos" fallback={<CatalogoProductosCardSkeleton />}>
          <CatalogoProductosCard>
            <AsyncWidget
              title="los productos"
              className="rounded-none border-x-0 border-b-0 shadow-none"
              fallback={<CatalogoProductosSkeleton />}
            >
              <CatalogoProductos searchParams={searchParams} />
            </AsyncWidget>
          </CatalogoProductosCard>
        </AsyncWidget>
      </PageBody>
    </>
  );
}
