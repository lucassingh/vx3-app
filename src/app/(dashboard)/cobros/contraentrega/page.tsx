import { ContraentregaSkeleton, ContraentregaView } from "@/components/cobros/contraentrega";
import { ImportButton } from "@/components/cobros/import-button";
import { PageBody } from "@/components/layout/page-header";
import { RouteHeader } from "@/components/pedidos/route-header";
import { AsyncWidget } from "@/components/views/async-widget";
import { getRouteMetadata } from "@/lib/navigation";

const HREF = "/cobros/contraentrega";

export const metadata = getRouteMetadata(HREF);

/** M7 · Contraentrega con Transtech: de facturado a rendido (RF-M7-06 a RF-M7-09). */
export default function Page() {
  return (
    <>
      <RouteHeader
        href={HREF}
        actions={
          <>
            <ImportButton
              label="Importar export de Zupply"
              successTitle="Export de Zupply importado"
              successDescription="los estados se cruzan con DUX y los extractos de los cuatro bancos."
            />
            <ImportButton
              label="Importar extractos"
              successTitle="Extracto importado"
              successDescription="los cobros nuevos se cruzan con los pedidos contraentrega."
            />
          </>
        }
      />
      <PageBody>
        <AsyncWidget title="la contraentrega" fallback={<ContraentregaSkeleton />}>
          <ContraentregaView />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
