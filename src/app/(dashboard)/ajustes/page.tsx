import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AlertasCard, AlertasSkeleton } from "@/components/plataforma/ajustes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AsyncWidget } from "@/components/views/async-widget";
import { ThemeSelector } from "@/components/views/theme-selector";
import { findRoute, getRouteMetadata } from "@/lib/navigation";

const HREF = "/ajustes";

export const metadata = getRouteMetadata(HREF);

export default function SettingsPage() {
  const { link } = findRoute(HREF)!;

  return (
    <>
      <PageHeader eyebrow="Configuración" title={link.title} description={link.description} />
      <PageBody>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Apariencia</CardTitle>
              <CardDescription>Elegí cómo se ve la app en este dispositivo.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <ThemeSelector />
          </CardContent>
        </Card>

        <AsyncWidget title="las alertas" fallback={<AlertasSkeleton />}>
          <AlertasCard />
        </AsyncWidget>
      </PageBody>
    </>
  );
}
