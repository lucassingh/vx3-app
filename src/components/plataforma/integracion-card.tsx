"use client";

import {
  ArrowUpRight,
  Database,
  FileUp,
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/browser";
import type { Integracion, IntegracionEstado } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { probarIntegracion, sincronizarIntegracion } from "@/modules/platform/credentials/actions";
import { usaCredencial } from "@/modules/platform/credentials/integraciones";
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

/** Lo que ya está conectado se prueba de verdad; el resto, contra la API simulada. */
async function pedirPrueba(id: string) {
  if (!usaCredencial(id)) return api.plataforma.integraciones.probar(id);
  const result = await probarIntegracion({ integracion: id });
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

/** Prueba la conexión y la rechaza si la integración no respondió (para toast.promise). */
function probar(integracion: Pick<Integracion, "id">) {
  return pedirPrueba(integracion.id).then((result) => {
    if (!result.ok) throw new Error(result.mensaje);
    return result;
  });
}

export function IntegracionCard({ integracion, labels }: { integracion: Integracion; labels: IntegracionLabels }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const Icon = ICONS[integracion.id] ?? PlugZap;
  const estado = ESTADO_INTEGRACION[integracion.estado];
  const puedeReintentar =
    !integracion.importa && (integracion.estado === "degradado" || integracion.estado === "caido");

  const onProbar = () => {
    startTransition(async () => {
      await toast
        .promise(probar(integracion), {
          loading: `Probando ${integracion.nombre}…`,
          success: (result) => result.mensaje,
          error: (error) => (error instanceof Error ? error.message : "No respondió."),
        })
        .unwrap()
        .catch(() => {});
      router.refresh();
    });
  };

  const onSincronizar = () => {
    const { id, nombre } = integracion;
    if (!usaCredencial(id)) return;
    startTransition(async () => {
      try {
        const result = await sincronizarIntegracion({ integracion: id });
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

  const onReintentar = () => {
    startTransition(async () => {
      try {
        await api.plataforma.integraciones.reintentar(integracion.id);
        toast.success(`${integracion.nombre} sincronizó de nuevo`);
        router.refresh();
      } catch (error) {
        toast.error(`No se pudo reintentar ${integracion.nombre}`, {
          description: error instanceof Error ? error.message : undefined,
          action: { label: "Reintentar", onClick: onReintentar },
        });
      }
    });
  };

  const onArchivo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    startTransition(async () => {
      try {
        const { importados } = await api.plataforma.integraciones.importar(integracion.id);
        toast.success(`${file.name} importado`, {
          description: `${importados} registros nuevos de ${integracion.nombre} ya están para conciliar.`,
        });
        router.refresh();
      } catch {
        toast.error("No se pudo leer el archivo", { description: "Revisá que sea el export o el extracto del día." });
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
            <CardTitle className="truncate">{integracion.nombre}</CardTitle>
            <CardDescription className="truncate">{integracion.tipo}</CardDescription>
          </div>
        </div>
        <Badge variant={estado.variant} dot>
          {estado.label}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <p className="text-[13px] text-pretty text-muted-foreground">{integracion.detalle}</p>

        <dl className="grid grid-cols-3 gap-3">
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
              ) : integracion.importa ? (
                <span className="text-muted-foreground">No usa: se importa el archivo</span>
              ) : (
                <span className="text-muted-foreground">Falta el acceso</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="flex-wrap">
        {integracion.importa ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={onArchivo}
            />
            <Button variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
              {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <FileUp />}
              {integracion.id === "zupply" ? "Importar export" : "Importar extracto"}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={onProbar}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <PlugZap />}
            Probar conexión
          </Button>
        )}
        {usaCredencial(integracion.id) && (
          <Button variant="outline" size="sm" disabled={pending} onClick={onSincronizar}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw />}
            Sincronizar ahora
          </Button>
        )}
        {usaCredencial(integracion.id) && (
          <CargarCredencial
            integracion={integracion.id}
            nombre={integracion.nombre}
            yaCargada={Boolean(integracion.credencial)}
          />
        )}
        {puedeReintentar && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={onReintentar}>
            <RotateCw />
            Reintentar
          </Button>
        )}
        {integracion.enlace && (
          <Button variant="ghost" size="sm" className="ml-auto" asChild>
            <Link href={integracion.enlace.href}>
              {integracion.enlace.label}
              <ArrowUpRight />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** Acción del header: prueba todas las conexiones en paralelo. */
export function ProbarTodas({ integraciones }: { integraciones: Pick<Integracion, "id" | "nombre">[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const results = await Promise.allSettled(integraciones.map((integracion) => probar(integracion)));
      const fallidas = integraciones.filter((_, index) => results[index]?.status === "rejected");
      if (fallidas.length === 0) {
        toast.success(`Las ${integraciones.length} conexiones respondieron`);
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
