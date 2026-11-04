import { Coins, Layers, MessagesSquare, Wallet } from "lucide-react";
import { BarList } from "@/components/kit/bar-list";
import { ColumnChart, type ChartBar } from "@/components/kit/column-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { BarListSkeleton, ChartSkeleton, SkeletonText, StatGridSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { formatDate, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { AdminKeyForm, ModeloYKeyForm, TopeGastoForm } from "./ia-forms";
import { cuando, StatCard } from "./shared";

const usd2 = (value: number) => formatUsd(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statsClass = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/* ---- Indicadores ------------------------------------------------------------ */

export async function IaStats() {
  const [consumo, config] = await Promise.all([api.plataforma.ia.consumo(), api.plataforma.ia.config()]);
  const modelo = config.modelos.find((item) => item.id === config.modelo);

  return (
    <section aria-label="Consumo de la IA" className={statsClass}>
      <StatCard
        icon={Wallet}
        label="Gasto · 30 días"
        value={usd2(consumo.costo30dUsd)}
        hint={`Proyección del mes: ${usd2(consumo.proyeccionMesUsd)}`}
      />
      <StatCard
        icon={MessagesSquare}
        label="Conversaciones del bot"
        value={formatNumber(consumo.conversaciones30d)}
        hint="Atendidas en los últimos 30 días"
      />
      <StatCard
        icon={Coins}
        label="Costo por conversación"
        value={formatUsd(consumo.costoPorConversacionUsd, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
        hint={`Con ${modelo?.nombre ?? config.modelo}`}
      />
      <StatCard
        icon={Layers}
        label="Tokens · 30 días"
        value={formatNumber(consumo.tokens30d, { notation: "compact", maximumFractionDigits: 0 })}
        hint={`${formatPercent(consumo.pctCache, { maximumFractionDigits: 0 })} de la entrada salió de la caché`}
      />
    </section>
  );
}

export function IaStatsSkeleton() {
  return (
    <>
      <LoadingLabel>Cargando consumo…</LoadingLabel>
      <StatGridSkeleton count={4} className={statsClass} />
    </>
  );
}

/* ---- Gasto diario ----------------------------------------------------------- */

function GastoFrame({ total, children }: { total: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Gasto diario</CardTitle>
          <CardDescription>Medido con el uso que devuelve cada respuesta de la API · últimos 30 días</CardDescription>
        </div>
        <div className="text-right">
          {total}
          <p className="text-xs text-muted-foreground">en el período</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-6">{children}</CardContent>
    </Card>
  );
}

export async function GastoDiarioCard() {
  const { diario, costo30dUsd } = await api.plataforma.ia.consumo();
  const last = diario.length - 1;
  // Techo en múltiplos de US$ 0,20 para que las barras usen la altura.
  const max = Math.ceil(Math.max(...diario.map((punto) => punto.value)) / 0.2) * 0.2;
  const bars: ChartBar[] = diario.map((punto, index) => ({
    value: punto.value,
    valueLabel: usd2(punto.value),
    label:
      index === last
        ? "Hoy, hasta ahora"
        : index === last - 1
          ? "Ayer"
          : formatDate(punto.date, { weekday: "long", day: "numeric", month: "long" }),
    axisLabel: index === last ? "Hoy" : formatDate(punto.date, { day: "numeric", month: "short" }),
  }));

  return (
    <GastoFrame
      total={<p className="text-xl leading-6 font-semibold tracking-tight tabular-nums">{usd2(costo30dUsd)}</p>}
    >
      <ColumnChart bars={bars} max={max} ticks={[usd2(max), usd2(max / 2), "0"]} description="Gasto de la IA por día" />
    </GastoFrame>
  );
}

export function GastoDiarioSkeleton() {
  return (
    <GastoFrame total={<Skeleton className="ml-auto h-6 w-16" />}>
      <LoadingLabel>Cargando gasto…</LoadingLabel>
      <ChartSkeleton bars={30} />
    </GastoFrame>
  );
}

/* ---- Por tipo de caso ------------------------------------------------------- */

function CasosFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Por tipo de caso</CardTitle>
          <CardDescription>En qué se va el gasto · 30 días</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function PorCasoCard() {
  const { porCaso, costo30dUsd } = await api.plataforma.ia.consumo();
  return (
    <CasosFrame>
      <BarList
        items={porCaso.map((caso) => ({
          id: caso.id,
          label: caso.label,
          value: caso.value,
          valueLabel: usd2(caso.value),
          detail: formatPercent(caso.value / costo30dUsd, { maximumFractionDigits: 0 }),
        }))}
      />
    </CasosFrame>
  );
}

export function PorCasoSkeleton() {
  return (
    <CasosFrame>
      <LoadingLabel>Cargando casos…</LoadingLabel>
      <BarListSkeleton rows={6} />
    </CasosFrame>
  );
}

/* ---- Modelo y API key ------------------------------------------------------- */

function ModeloFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Cuenta de Claude y modelo del bot</CardTitle>
          <CardDescription>
            La IA la paga VX3 con su propia cuenta de Anthropic. La key se guarda cifrada y nunca se muestra completa.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function ModeloCard() {
  const config = await api.plataforma.ia.config();
  const label = config.apiKey ? `${config.apiKey.cargadaPor} · ${cuando(config.apiKey.cargadaEn)}` : null;
  return (
    <ModeloFrame>
      <ModeloYKeyForm config={config} apiKeyLabel={label} />
    </ModeloFrame>
  );
}

export function ModeloSkeleton() {
  return (
    <ModeloFrame>
      <LoadingLabel>Cargando configuración…</LoadingLabel>
      <SkeletonText lines={6} />
    </ModeloFrame>
  );
}

/* ---- Tope y Admin key ------------------------------------------------------- */

function TopeFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Tope de gasto mensual</CardTitle>
          <CardDescription>Con aviso antes de llegar, para que nunca haya sorpresas</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function TopeCard() {
  const [config, consumo] = await Promise.all([api.plataforma.ia.config(), api.plataforma.ia.consumo()]);
  return (
    <TopeFrame>
      <TopeGastoForm
        tope={config.topeMensualUsd}
        alertaPct={config.alertaPct}
        gasto={consumo.costo30dUsd}
        gastoLabel={usd2(consumo.costo30dUsd)}
      />
    </TopeFrame>
  );
}

export function TopeSkeleton() {
  return (
    <TopeFrame>
      <LoadingLabel>Cargando tope…</LoadingLabel>
      <SkeletonText lines={4} />
    </TopeFrame>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Reporte oficial de costos</CardTitle>
          <CardDescription>
            Opcional: con una Admin API key la app trae el reporte de Anthropic y lo concilia con lo que mide.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export async function AdminKeyCard() {
  const { adminKey } = await api.plataforma.ia.config();
  return (
    <AdminFrame>
      <AdminKeyForm
        adminKey={adminKey}
        label={adminKey ? `${adminKey.cargadaPor} · ${cuando(adminKey.cargadaEn)}` : null}
      />
    </AdminFrame>
  );
}

export function AdminKeySkeleton() {
  return (
    <AdminFrame>
      <LoadingLabel>Cargando…</LoadingLabel>
      <SkeletonText lines={2} />
    </AdminFrame>
  );
}
