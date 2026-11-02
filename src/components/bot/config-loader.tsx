import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { formatPercent, formatRelativeTime } from "@/lib/format";
import { ConfigEditor, type VersionesView } from "./config-editor";

const pct = (value: number) => formatPercent(value, { maximumFractionDigits: 0 });

/** Pide la configuración y arma las fechas de las versiones en el servidor. */
export async function ConfigLoader() {
  const { versiones, generadoEn, ...config } = await api.bot.config();
  const now = new Date(generadoEn).getTime();

  const view: VersionesView = {
    publicada: {
      numero: versiones.publicada.numero,
      cuando: formatRelativeTime(versiones.publicada.publicadaEn, now),
      por: versiones.publicada.por,
      acierto: pct(versiones.publicada.acierto),
    },
    borrador: versiones.borrador && {
      numero: versiones.borrador.numero,
      cuando: formatRelativeTime(versiones.borrador.editadoEn, now),
      por: versiones.borrador.por,
      cambios: versiones.borrador.cambios,
    },
    historial: versiones.historial.map((version) => ({
      numero: version.numero,
      cuando: formatRelativeTime(version.fecha, now),
      por: version.por,
      resumen: version.resumen,
      acierto: pct(version.acierto),
    })),
  };

  return <ConfigEditor initial={config} versiones={view} />;
}

export function ConfigSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <LoadingLabel>Cargando la configuración del bot…</LoadingLabel>
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-64" />
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <Skeleton className="h-9 w-full max-w-2xl rounded-lg" />
          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
          <SkeletonText lines={4} />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card className="p-5">
          <SkeletonText lines={5} />
        </Card>
        <Card className="h-[30rem] p-5">
          <SkeletonText lines={3} />
        </Card>
      </div>
    </div>
  );
}
