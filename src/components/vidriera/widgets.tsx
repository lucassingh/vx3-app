import { Eye, PackageOpen, ShoppingCart, Unlock } from "lucide-react";
import { Funnel } from "@/components/kit/funnel";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { BarListSkeleton, CardSkeleton, SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { formatCurrency, formatNumber } from "@/lib/format";
import { LinkPreview, PhonePreview } from "./phone-preview";
import { VidrieraEditor } from "./vidriera-editor";

export async function VidrieraKpis() {
  const { kpis } = await api.vidriera.resumen();
  return (
    <KpiGrid
      items={kpis}
      label="Indicadores de la vidriera"
      icons={{ visitas: Eye, carritos: ShoppingCart, pedidos: PackageOpen, liberados: Unlock }}
    />
  );
}

export function VidrieraKpisSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

function EmbudoFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Embudo de la vidriera</CardTitle>
          <CardDescription>
            De la visita al pedido, en los últimos 7 días. Estos eventos también se le mandan a Meta para optimizar la pauta.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function EmbudoVidrieraCard() {
  const { embudo } = await api.vidriera.resumen();
  return (
    <EmbudoFrame>
      <Funnel steps={embudo} />
    </EmbudoFrame>
  );
}

export function EmbudoVidrieraSkeleton() {
  return (
    <EmbudoFrame>
      <LoadingLabel>Cargando el embudo…</LoadingLabel>
      <BarListSkeleton rows={6} />
    </EmbudoFrame>
  );
}

/** Colecciones, destacados y acceso: montos y conteos formateados en el servidor. */
export async function VidrieraEditorLoader() {
  const { colecciones, destacados, acceso } = await api.vidriera.resumen();
  return (
    <VidrieraEditor
      colecciones={colecciones.map((coleccion) => ({ ...coleccion, visitasLabel: formatNumber(coleccion.visitas7d) }))}
      destacados={destacados.map((destacado) => ({
        ...destacado,
        precioLabel: formatCurrency(destacado.precio),
        vistasLabel: formatNumber(destacado.vistas7d),
      }))}
      acceso={acceso}
    />
  );
}

export function VidrieraEditorSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando colecciones…</LoadingLabel>
      <CardSkeleton>
        <SkeletonText lines={6} />
      </CardSkeleton>
      <CardSkeleton>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
      </CardSkeleton>
    </>
  );
}

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Vista de la clienta</CardTitle>
          <CardDescription>La página de producto que manda el bot, mobile-first</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-5">{children}</CardContent>
    </Card>
  );
}

export async function VidrieraPreviewCard() {
  const { vista } = await api.vidriera.resumen();
  return (
    <PreviewFrame>
      <PhonePreview vista={vista} />
      <LinkPreview vista={vista} />
    </PreviewFrame>
  );
}

export function VidrieraPreviewSkeleton() {
  return (
    <PreviewFrame>
      <LoadingLabel>Cargando la vista previa…</LoadingLabel>
      <Skeleton className="mx-auto h-[36rem] w-full max-w-[19.5rem] rounded-[2.4rem]" />
    </PreviewFrame>
  );
}
