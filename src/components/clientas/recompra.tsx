import { Banknote, HandCoins, Send, ShoppingBag } from "lucide-react";
import { KpiGrid, KpiGridSkeleton } from "@/components/kit/kpi-grid";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import type { Kpi } from "@/lib/api/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { RecompraLista, type RecompraItemView } from "./recompra-lista";
import { diasLabel } from "./shared";

/* ---- Resultados de los últimos 30 días -------------------------------------- */

export async function RecompraResultadosGrid() {
  const r = await api.clientas.recompraResultados();
  const parte = r.contactadas > 0 ? r.compraron / r.contactadas : 0;

  const kpis: Kpi[] = [
    {
      id: "contactadas",
      label: "Contactadas · 30 días",
      value: r.contactadas,
      format: "number",
      hint: "Desde esta lista, a mano",
    },
    {
      id: "compraron",
      label: "Volvieron a comprar",
      value: r.compraron,
      format: "number",
      hint: `${formatPercent(parte, { maximumFractionDigits: 0 })} de las contactadas, en los 14 días siguientes`,
    },
    {
      id: "ventas",
      label: "Lo que compraron",
      value: r.ventas,
      format: "currency",
      hint: "Es un conteo: algunas iban a comprar igual",
    },
    {
      id: "margen",
      label: "Margen de esas compras",
      value: r.margen,
      format: "currency",
      hint: "Sin costo de pauta",
    },
  ];

  return (
    <KpiGrid
      items={kpis}
      label="Resultados de la recompra de los últimos 30 días"
      icons={{ contactadas: Send, compraron: ShoppingBag, ventas: Banknote, margen: HandCoins }}
    />
  );
}

export function RecompraResultadosSkeleton() {
  return <KpiGridSkeleton count={4} />;
}

/* ---- Lista del día ------------------------------------------------------------ */

export async function RecompraListaLoader() {
  const { hoy, esperando, enCola, tope } = await api.clientas.recompra();

  const views: RecompraItemView[] = hoy.map((item) => ({
    ...item,
    totalTexto: formatCurrency(item.totalComprado),
    ultimoPedidoTexto: item.ultimoPedido
      ? `${diasLabel(item.ultimoPedido.haceDias)} · ${formatCurrency(item.ultimoPedido.total)}`
      : "Sin compras registradas",
    ultimoPedidoDetalle: item.ultimoPedido ? `${item.ultimoPedido.id} · ${item.ultimoPedido.resumen}` : "",
  }));

  return <RecompraLista initialItems={views} initialEsperando={esperando} enCola={enCola} tope={tope} />;
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
