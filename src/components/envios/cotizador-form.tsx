"use client";

import {
  Calculator,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Package,
  Plus,
  Save,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { CotizacionEnvio, CotizadorOpciones, CotizarInput } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Item = { key: number; sku: string; bultos: number };

const INICIAL: Item[] = [
  { key: 1, sku: "CJATN14", bultos: 2 },
  { key: 2, sku: "VN16", bultos: 1 },
  { key: 3, sku: "LN35", bultos: 2 },
];

/**
 * Cotizador de envíos (RF-M6-01, 03 y 09). Los resultados llegan después de
 * una acción del usuario, así que se formatean acá sin riesgo al hidratar.
 */
export function CotizadorForm({ opciones }: { opciones: CotizadorOpciones }) {
  const id = useId();
  const [cp, setCp] = useState("1824");
  const [localidad, setLocalidad] = useState("Lanús");
  const [items, setItems] = useState<Item[]>(INICIAL);
  const [modoCorreo, setModoCorreo] = useState<CotizarInput["modoCorreo"]>("domicilio");
  const [simularFalla, setSimularFalla] = useState(false);
  const [cotizacion, setCotizacion] = useState<CotizacionEnvio | null>(null);
  const [guardada, setGuardada] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const nextKey = useRef(INICIAL.length + 1);

  const cotizar = (input: CotizarInput) => {
    startTransition(async () => {
      try {
        const result = await api.envios.cotizar(input);
        setCotizacion(result);
        setGuardada(null);
      } catch {
        toast.error("No se pudo cotizar", {
          description: "Revisá la conexión e intentá de nuevo.",
          action: { label: "Reintentar", onClick: () => cotizar(input) },
        });
      }
    });
  };

  const input = (): CotizarInput => ({
    cp: cp.trim(),
    localidad: localidad.trim() || undefined,
    items: items.map(({ sku, bultos }) => ({ sku, bultos })),
    modoCorreo,
    simularFalla,
  });

  // Primera cotización con el ejemplo cargado, para que la pantalla no arranque vacía.
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    let active = true;
    api.envios
      .cotizar({
        cp: "1824",
        localidad: "Lanús",
        items: INICIAL.map(({ sku, bultos }) => ({ sku, bultos })),
        modoCorreo: "domicilio",
        simularFalla: false,
      })
      .then((result) => active && setCotizacion(result))
      .catch(() => {})
      .finally(() => active && setBooting(false));
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    cotizar(input());
  };

  const guardar = () => {
    if (!cotizacion) return;
    startSaving(async () => {
      try {
        await api.envios.guardarCotizacion(cotizacion.id);
        setGuardada(cotizacion.id);
        toast.success(`Cotización ${cotizacion.id} guardada`, {
          description: "El chat, la factura y la etiqueta van a usar este mismo monto.",
        });
      } catch {
        toast.error("No se pudo guardar la cotización", { action: { label: "Reintentar", onClick: guardar } });
      }
    });
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Datos del envío</CardTitle>
            <CardDescription>Lo mismo que pregunta el bot en el chat: destino y lo que lleva el pedido</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit} className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Destino
              </legend>
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-cp`}>Código postal</Label>
                  <Input
                    id={`${id}-cp`}
                    inputMode="numeric"
                    maxLength={4}
                    value={cp}
                    onChange={(event) => setCp(event.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-localidad`}>Localidad</Label>
                  <Input
                    id={`${id}-localidad`}
                    value={localidad}
                    onChange={(event) => setLocalidad(event.target.value)}
                    placeholder="Como la escribió la clienta"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Ejemplos:</span>
                {opciones.destinos.map((destino) => (
                  <button
                    key={destino.cp}
                    type="button"
                    onClick={() => {
                      setCp(destino.cp);
                      setLocalidad(destino.localidad);
                    }}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {destino.localidad} <span className="tabular-nums">· {destino.cp}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Productos, en bultos
              </legend>
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <NativeSelect
                      aria-label={`Producto ${index + 1}`}
                      value={item.sku}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) => (row.key === item.key ? { ...row, sku: event.target.value } : row)),
                        )
                      }
                      className="min-w-0 flex-1"
                    >
                      {opciones.productos.map((producto) => (
                        <option key={producto.sku} value={producto.sku}>
                          {producto.label} · {producto.detalle}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      aria-label={`Bultos del producto ${index + 1}`}
                      value={item.bultos}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key
                              ? { ...row, bultos: Math.max(1, Number(event.target.value) || 1) }
                              : row,
                          ),
                        )
                      }
                      className="w-20 shrink-0 tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar el producto ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    { key: nextKey.current++, sku: opciones.productos[0]?.sku ?? "", bultos: 1 },
                  ])
                }
              >
                <Plus />
                Agregar producto
              </Button>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Entrega del Correo
              </legend>
              <div className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5">
                {(["domicilio", "sucursal"] as const).map((modo) => (
                  <label
                    key={modo}
                    className={cn(
                      "inline-flex h-full cursor-pointer items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring",
                      modoCorreo === modo && "bg-surface text-foreground shadow-card",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-modo`}
                      value={modo}
                      checked={modoCorreo === modo}
                      onChange={() => setModoCorreo(modo)}
                      className="sr-only"
                    />
                    {modo === "domicilio" ? "A domicilio" : "A sucursal"}
                  </label>
                ))}
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3.5">
                <div className="space-y-0.5">
                  <Label htmlFor={`${id}-falla`}>Simular que MiCorreo no responde</Label>
                  <p className="text-xs text-muted-foreground">
                    Cotiza con la tabla de respaldo por zona y peso, el “problema número 1” del bot de hoy.
                  </p>
                </div>
                <Switch id={`${id}-falla`} checked={simularFalla} onCheckedChange={setSimularFalla} />
              </div>
            </fieldset>

            <Button type="submit" size="lg" className="w-full" disabled={pending || cp.length < 4}>
              {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Calculator />}
              {pending ? "Cotizando…" : "Cotizar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div aria-live="polite" aria-busy={pending}>
        {cotizacion ? (
          <Resultado
            cotizacion={cotizacion}
            pending={pending}
            guardada={guardada === cotizacion.id}
            saving={saving}
            onGuardar={guardar}
          />
        ) : pending || booting ? (
          <ResultadoSkeleton />
        ) : (
          <Card>
            <EmptyState
              icon={Calculator}
              title="Todavía no hay cotización"
              description="Completá el destino y los productos."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function Resultado({
  cotizacion,
  pending,
  guardada,
  saving,
  onGuardar,
}: {
  cotizacion: CotizacionEnvio;
  pending: boolean;
  guardada: boolean;
  saving: boolean;
  onGuardar: () => void;
}) {
  const { destino } = cotizacion;

  return (
    <Card className={cn("transition-opacity", pending && "opacity-60")}>
      <CardHeader>
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Cotización <span className="font-mono">{cotizacion.id}</span>
          </CardTitle>
          <CardDescription>
            Vence en {cotizacion.vigenciaHoras} h · queda guardada con todos los datos de entrada y la respuesta del
            Correo
          </CardDescription>
        </div>
        <Badge variant={cotizacion.fuente === "respaldo" ? "warning" : "success"} dot>
          {cotizacion.fuente === "respaldo" ? "Estimada" : "MiCorreo"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <p className={cn("flex items-start gap-2 text-sm", !destino.valido && "text-danger")}>
          {destino.valido ? (
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          {destino.detalle}
        </p>

        {cotizacion.aviso && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-[13px]">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            {cotizacion.aviso}
          </p>
        )}

        {cotizacion.faltaParaMinimo > 0 && (
          <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px]">
            La mercadería suma {formatCurrency(cotizacion.mercaderia)}: faltan{" "}
            <span className="font-semibold">{formatCurrency(cotizacion.faltaParaMinimo)}</span> para el mínimo de
            compra.
          </p>
        )}

        {cotizacion.cajas.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Bultos armados · {formatNumber(cotizacion.pesoTotalKg)} kg con embalaje
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {cotizacion.cajas.map((caja) => (
                <li key={caja.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Package aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {caja.caja} <span className="font-normal text-muted-foreground">· {caja.medidas}</span>
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{caja.contenido}</p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">{formatNumber(caja.pesoKg)} kg</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Máximo del Correo: 25 kg y 150 cm por lado en cada bulto.</p>
          </section>
        )}

        {cotizacion.opciones.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Opciones</h3>
            <ul className="space-y-2">
              {cotizacion.opciones.map((opcion) => (
                <li
                  key={opcion.id}
                  className={cn(
                    "flex items-start justify-between gap-4 rounded-lg border p-3.5",
                    opcion.recomendada && opcion.disponible ? "border-primary/40 bg-primary/5" : "border-border",
                    !opcion.disponible && "opacity-60",
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {opcion.label}
                      {opcion.recomendada && opcion.disponible && <Badge variant="primary">Recomendada</Badge>}
                      {opcion.estimada && <Badge variant="warning">Estimada</Badge>}
                    </p>
                    <p className="text-[13px] text-muted-foreground">{opcion.detalle}</p>
                    {opcion.porCaja && opcion.porCaja.length > 1 && opcion.disponible && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {opcion.porCaja
                          .map((precio, index) => `Bulto ${index + 1}: ${formatCurrency(precio)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {!opcion.disponible ? (
                      <span className="text-[13px] text-muted-foreground">No disponible</span>
                    ) : opcion.precio === null ? (
                      <span className="text-[13px] font-medium">Paga en destino</span>
                    ) : (
                      <span className="text-base font-semibold tabular-nums">
                        {formatCurrency(opcion.precio + opcion.embalaje)}
                      </span>
                    )}
                    {opcion.disponible && opcion.embalaje > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {opcion.precio === null ? "Embalaje " : "Incluye embalaje "}
                        {formatCurrency(opcion.embalaje)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            La factura usa la cotización guardada, no un número copiado del chat.
          </p>
          <Button onClick={onGuardar} disabled={!destino.valido || guardada || saving}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : guardada ? <CircleCheck /> : <Save />}
            {guardada ? "Guardada" : "Guardar cotización"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultadoSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}
