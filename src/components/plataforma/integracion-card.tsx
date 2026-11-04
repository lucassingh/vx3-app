"use client";

import {
  Database,
  KeyRound,
  Landmark,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  Package,
  PlugZap,
  RefreshCw,
  RotateCw,
  ShoppingBag,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Integracion, IntegracionEstado } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { probarIntegracion, sincronizarIntegracion } from "@/modules/platform/credentials/actions";
import { usaCredencial, type IntegracionConCredencial } from "@/modules/platform/credentials/integraciones";
import { CargarCredencial } from "./cargar-credencial";

const ICONS: Record<string, LucideIcon> = {
  dux: Database,
  meta: Megaphone,
  whatsapp: MessageCircle,
  tiendanube: ShoppingBag,
  correo: Package,
  zupply: Truck,
  santander: Landmark,
  supervielle: Landmark,
  provincia: Landmark,
  nacion: Landmark,
  anthropic: Sparkles,
};

export const ESTADO_INTEGRACION: Record<
  IntegracionEstado,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  ok: { label: "Funcionando", variant: "success" },
  degradado: { label: "Con demoras", variant: "warning" },
  caido: { label: "Caída", variant: "danger" },
  pendiente: { label: "Pendiente", variant: "neutral" },
};

/** Textos de fecha armados en el servidor. */
export type IntegracionLabels = { ultimoSync: string; credencial: string | null };

/** Prueba la conexión y la rechaza si la integración no respondió (para toast.promise). */
async function probar(id: IntegracionConCredencial) {
  const result = await probarIntegracion({ integracion: id });
  if (!result.ok) throw new Error(result.error.message);
  if (!result.data.ok) throw new Error(result.data.mensaje);
  return result.data;
}

export function IntegracionCard({ integracion, labels }: { integracion: Integracion; labels: IntegracionLabels }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { id, nombre } = integracion;
  const Icon = ICONS[id] ?? PlugZap;
  const estado = ESTADO_INTEGRACION[integracion.estado];
  // Solo lo que ya está conectado tiene algo para mostrar y algo para hacer.
  const conectada = usaCredencial(id) ? id : null;
  const puedeReintentar = integracion.estado === "degradado" || integracion.estado === "caido";

  const onProbar = () => {
    if (!conectada) return;
    startTransition(async () => {
      await toast
        .promise(probar(conectada), {
          loading: `Probando ${nombre}…`,
          success: (result) => result.mensaje,
          error: (error) => (error instanceof Error ? error.message : "No respondió."),
        })
        .unwrap()
        .catch(() => {});
      router.refresh();
    });
  };

  const onSincronizar = () => {
    if (!conectada) return;
    startTransition(async () => {
      try {
        const result = await sincronizarIntegracion({ integracion: conectada });
        if (!result.ok) throw new Error(result.error.message);
        toast.success(`${nombre} se está sincronizando`, { description: "Tarda unos minutos." });
        router.refresh();
      } catch (error) {
        toast.error(`No se pudo sincronizar ${nombre}`, {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{nombre}</CardTitle>
            <CardDescription className="truncate">{integracion.tipo}</CardDescription>
          </div>
        </div>
        <Badge variant={estado.variant} dot>
          {estado.label}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <p className="text-[13px] text-pretty text-muted-foreground">{integracion.detalle}</p>

        {conectada && (
          <>
            <dl className="grid grid-cols-2 gap-3">
              {integracion.metricas.map((metrica) => (
                <div key={metrica.label} className="min-w-0">
                  <dt className="truncate text-xs text-muted-foreground">{metrica.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">{metrica.value}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-auto space-y-2 rounded-lg border border-border bg-muted/50 p-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Frecuencia</dt>
                <dd className="text-right">{integracion.frecuencia}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Último sync</dt>
                <dd className="text-right first-letter:uppercase">{labels.ultimoSync}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <KeyRound aria-hidden className="size-3.5" />
                  Credencial
                </dt>
                <dd className="min-w-0 text-right">
                  {integracion.credencial ? (
                    <>
                      <span className="font-mono text-foreground">{integracion.credencial.mascara}</span>
                      <span className="block text-muted-foreground">{labels.credencial}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Falta cargarla</span>
                  )}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>

      {conectada && (
        <CardFooter className="flex-wrap">
          <Button variant="outline" size="sm" disabled={pending} onClick={onProbar}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <PlugZap />}
            Probar conexión
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !integracion.credencial} onClick={onSincronizar}>
            {pending ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : puedeReintentar ? (
              <RotateCw />
            ) : (
              <RefreshCw />
            )}
            {puedeReintentar ? "Reintentar" : "Sincronizar ahora"}
          </Button>
          <CargarCredencial integracion={conectada} nombre={nombre} yaCargada={Boolean(integracion.credencial)} />
        </CardFooter>
      )}
    </Card>
  );
}

/** Acción del header: prueba en paralelo todo lo que ya está conectado. */
export function ProbarTodas({ integraciones }: { integraciones: { id: IntegracionConCredencial; nombre: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const results = await Promise.allSettled(integraciones.map(({ id }) => probar(id)));
      const fallidas = integraciones.filter((_, index) => results[index]?.status === "rejected");
      if (fallidas.length === 0) {
        toast.success(
          integraciones.length === 1 ? "La conexión respondió" : `Las ${integraciones.length} conexiones respondieron`,
        );
      } else {
        toast.error(`${fallidas.length} sin respuesta`, {
          description: fallidas.map((integracion) => integracion.nombre).join(", "),
        });
      }
      router.refresh();
    });
  };

  return (
    <Button variant="outline" onClick={onClick} disabled={pending || integraciones.length === 0}>
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <PlugZap />}
      {pending ? "Probando…" : "Probar todas"}
    </Button>
  );
}
