import { HandCoins, MessageCircleReply, Send, ShoppingBag } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { Kpi } from "@/lib/api/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { RecompraLista, type RecompraItemView } from "./recompra-lista";
import { diasLabel } from "./shared";

/* ---- Resultados de los últimos 7 días --------------------------------------- */

export async function RecompraResultadosGrid() {
  const r = await api.clientas.recompraResultados();
  const pct = (value: number) => formatPercent(value, { maximumFractionDigits: 0 });

  const kpis: Kpi[] = [
    { id: "contactadas", label: "Contactadas · 7 días", value: r.contactadas, format: "number", hint: "Desde esta lista, a mano" },
    { id: "respondieron", label: "Respondieron", value: r.respondieron, format: "number", hint: `${pct(r.respondieron / r.contactadas)} de las contactadas` },
    { id: "compraron", label: "Volvieron a comprar", value: r.compraron, format: "number", hint: `${pct(r.compraron / r.contactadas)} de las contactadas` },
    { id: "margen", label: "Margen recuperado", value: r.margen, format: "currency", hint: `Ventas por ${formatCurrency(r.ventas)}, sin costo de pauta` },
  ];

  return (
    <KpiGrid
      items={kpis}
      label="Resultados de la recompra de los últimos 7 días"
      icons={{ contactadas: Send, respondieron: MessageCircleReply, compraron: ShoppingBag, margen: HandCoins }}
    />
  );
}

export function RecompraResultadosSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Lista del día ------------------------------------------------------------ */

export async function RecompraListaLoader() {
  const items = await api.clientas.recompra();

  const views: RecompraItemView[] = items.map((item) => ({
    ...item,
    totalTexto: formatCurrency(item.totalComprado),
    ultimoPedidoTexto: item.ultimoPedido
      ? `${item.ultimoPedido.id} · ${diasLabel(item.ultimoPedido.haceDias).toLowerCase()} · ${formatCurrency(item.ultimoPedido.total)}`
      : "Sin pedidos registrados",
    ultimoPedidoDetalle: item.ultimoPedido?.resumen ?? "",
  }));

  return <RecompraLista initialItems={views} />;
}

export function RecompraListaSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <LoadingLabel>Cargando la lista del día…</LoadingLabel>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border p-4">
            <SkeletonText lines={3} />
            <Skeleton className="mt-4 h-20 w-full rounded-lg" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
