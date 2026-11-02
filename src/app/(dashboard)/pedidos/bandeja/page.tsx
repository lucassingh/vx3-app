import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { PageBody } from "@/components/layout/page-header";
import { PedidosCard, TrabadosSection } from "@/components/pedidos/bandeja";
import { RouteHeader } from "@/components/pedidos/route-header";
import { Button } from "@/components/ui/button";
import { getRouteMetadata } from "@/lib/navigation";

const HREF = "/pedidos/bandeja";

export const metadata = getRouteMetadata(HREF);

/** M5 · Bandeja única de pedidos (RF-M5-01, RF-M5-07). */
export default function Page({ searchParams }: PageProps<"/pedidos/bandeja">) {
  return (
    <>
      <RouteHeader
        href={HREF}
        actions={
          <Button asChild>
            <Link href="/pedidos/facturacion">
              <ReceiptText />
              Ir a facturación
            </Link>
          </Button>
        }
      />
      <PageBody>
        <PedidosCard searchParams={searchParams} />
        <TrabadosSection />
      </PageBody>
    </>
  );
}
