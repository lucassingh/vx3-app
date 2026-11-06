"use client";

import { ArrowRight, CircleCheck, LoaderCircle, PackagePlus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ProductThumb } from "@/components/kit/product-thumb";
import { precioBulto } from "@/modules/catalog/motor-precios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { Input, Label } from "@/components/ui/input";
import { NativeSelect, Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { Recepcion, RecepcionRenglon } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { TIPO_PROVEEDOR } from "./labels";

type RenglonEstado = { contado: string; cambioCosto: boolean; costoNuevo: string };

/** Estado de un renglón que todavía no se tocó. */
const SIN_CARGAR: RenglonEstado = { contado: "", cambioCosto: false, costoNuevo: "" };

const CHECKS = [
  { id: "orden", label: "Se completó en el orden de la boleta", regla: "RN-30" },
  { id: "contado", label: "Se contó todo, sin confiar en la boleta", regla: "RN-31" },
  { id: "foto", label: "Cada renglón coincide con la foto: estampado, tela, corte y colores", regla: "RN-32" },
  { id: "faltantes", label: "Los faltantes se le avisaron al proveedor", regla: "RN-35" },
] as const;

type CheckId = (typeof CHECKS)[number]["id"];

const toNumber = (value: string) => {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : 0;
};

function mensajeFaltantes(
  recepcion: Recepcion,
  fechaLabel: string,
  faltantes: { renglon: RecepcionRenglon; cantidad: number }[],
) {
  if (faltantes.length === 0) return "";
  const lineas = faltantes.map(
    ({ renglon, cantidad }) =>
      `• ${cantidad} ${renglon.prendasPorBulto === 6 ? (cantidad === 1 ? "media docena" : "medias docenas") : cantidad === 1 ? "docena" : "docenas"} de ${renglon.codigo} (${renglon.nombre})`,
  );
  return [
    `Hola ${recepcion.proveedor}, ¿cómo estás? Te escribimos de VX3 por la boleta ${recepcion.boleta} del ${fechaLabel}.`,
    "Contamos todo y nos faltó:",
    ...lineas,
    "¿Nos lo mandás en la próxima entrega o lo descontamos? ¡Gracias!",
  ].join("\n");
}

/** Recepción digital de una compra (RF-M2-02 a RF-M2-04, RF-M2-08), renglón por renglón de la boleta. */
export function RecepcionForm({ recepcion, fechaLabel }: { recepcion: Recepcion; fechaLabel: string }) {
  const router = useRouter();
  const uid = useId();
  const [renglones, setRenglones] = useState<Record<string, RenglonEstado>>(() =>
    Object.fromEntries(
      recepcion.renglones.map((item) => [
        item.id,
        {
          contado: String(item.contadoBultos),
          cambioCosto: item.costoDocenaNuevo !== null,
          costoNuevo: item.costoDocenaNuevo ? String(item.costoDocenaNuevo) : "",
        },
      ]),
    ),
  );
  const [checks, setChecks] = useState<Record<CheckId, boolean>>({
    orden: true,
    contado: true,
    foto: false,
    faltantes: false,
  });
  const [firmadoPor, setFirmadoPor] = useState(recepcion.firmadoPor ?? "");
  const [mensajeEditado, setMensajeEditado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargada, setCargada] = useState(recepcion.firmadoPor !== null);

  const actualizar = (id: string, cambio: Partial<RenglonEstado>) =>
    setRenglones((actual) => ({ ...actual, [id]: { ...(actual[id] ?? SIN_CARGAR), ...cambio } }));

  const filas = recepcion.renglones.map((renglon) => {
    const estado = renglones[renglon.id] ?? SIN_CARGAR;
    const contado = Math.max(0, Math.round(toNumber(estado.contado)));
    const costoNuevo = estado.cambioCosto ? toNumber(estado.costoNuevo) : null;
    return {
      renglon,
      estado,
      contado,
      diferencia: contado - renglon.boletaBultos,
      costoNuevo,
      precioAntes: precioBulto(renglon.familia, renglon.costoDocenaActual).precio,
      precioDespues: costoNuevo ? precioBulto(renglon.familia, costoNuevo).precio : null,
    };
  });

  const totalBoleta = filas.reduce((sum, fila) => sum + fila.renglon.boletaBultos, 0);
  const totalContado = filas.reduce((sum, fila) => sum + fila.contado, 0);
  const faltantes = filas
    .filter((fila) => fila.diferencia < 0)
    .map((fila) => ({ renglon: fila.renglon, cantidad: -fila.diferencia }));
  const sobrantes = filas.filter((fila) => fila.diferencia > 0).reduce((sum, fila) => sum + fila.diferencia, 0);
  const costosAlDia = filas.every((fila) => !fila.estado.cambioCosto || (fila.costoNuevo ?? 0) > 0);
  const nuevos = filas.filter((fila) => fila.renglon.nuevo);

  const mensaje = mensajeEditado ?? mensajeFaltantes(recepcion, fechaLabel, faltantes);
  const tipo = TIPO_PROVEEDOR[recepcion.proveedorTipo];

  const pendientes = [
    ...CHECKS.filter((check) => !checks[check.id] && (check.id !== "faltantes" || faltantes.length > 0)).map(
      (check) => check.label,
    ),
    ...(costosAlDia ? [] : ["Cargar el costo nuevo de los renglones marcados"]),
    ...(firmadoPor ? [] : ["La firma de otra persona"]),
  ];

  const cargar = () => {
    if (pendientes.length > 0) {
      toast.error("Todavía no se puede cerrar la carga", { description: pendientes[0] });
      return;
    }
    setCargando(true);
    const promise = api.stock.cargarRecepcion({
      renglones: filas.map((fila) => ({
        id: fila.renglon.id,
        contadoBultos: fila.contado,
        costoDocenaNuevo: fila.costoNuevo,
      })),
      firmadoPor,
    });
    toast.promise(promise, {
      loading: "Cargando la compra en DUX…",
      success: (resultado) => ({
        message: `Compra cargada en DUX (${resultado.comprobante})`,
        description: `${resultado.bultos} bultos ingresaron al stock · ${resultado.preciosActualizados} precios actualizados.`,
      }),
      error: (error) => (error instanceof Error ? error.message : "No se pudo cargar la compra"),
    });
    promise
      .then(() => {
        setCargada(true);
        router.refresh();
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div>
            <CardTitle>Recepción {recepcion.id}</CardTitle>
            <CardDescription>
              Planilla de carga digital: lo que dice la boleta contra lo que se contó. En DUX se carga el código del
              bulto y la cantidad en bultos (RN-33)
            </CardDescription>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4 sm:text-right">
            <div>
              <dt className="text-xs text-muted-foreground">Proveedor</dt>
              <dd className="font-medium">{recepcion.proveedor}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Boleta</dt>
              <dd className="font-mono text-[13px]">{recepcion.boleta}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fecha</dt>
              <dd className="font-medium">{fechaLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Recibió</dt>
              <dd className="font-medium">{recepcion.recibidoPor}</dd>
            </div>
          </dl>
        </CardHeader>

        <div className="relative w-full overflow-x-auto">
          <table className="w-full min-w-5xl text-sm">
            <caption className="sr-only">Renglones de la boleta {recepcion.boleta}</caption>
            <thead className="border-y border-border bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 pl-5 font-medium">
                  Producto
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Boleta
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Contado
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Diferencia
                </th>
                <th scope="col" className="px-3 py-2.5 pr-5 font-medium">
                  ¿Cambió el costo?
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((fila) => {
                const { renglon } = fila;
                const contadoId = `${uid}-contado-${renglon.id}`;
                const costoId = `${uid}-costo-${renglon.id}`;
                return (
                  <tr key={renglon.id} className={cn(fila.diferencia !== 0 && "bg-warning/5")}>
                    <td className="px-3 py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <ProductThumb sku={renglon.sku} colors={renglon.colores} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2">
                            <span className="max-w-64 truncate font-medium">{renglon.nombre}</span>
                            {renglon.nuevo && <Badge variant="accent">Nuevo</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{renglon.codigo}</span> · costo docena{" "}
                            {formatCurrency(renglon.costoDocenaActual)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{renglon.boletaBultos}</td>
                    <td className="px-3 py-3">
                      <label htmlFor={contadoId} className="sr-only">
                        Bultos contados de {renglon.codigo}
                      </label>
                      <Input
                        id={contadoId}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={fila.estado.contado}
                        onChange={(event) => actualizar(renglon.id, { contado: event.target.value })}
                        className="h-8 w-20 tabular-nums"
                        disabled={cargada}
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      {fila.diferencia === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={fila.diferencia < 0 ? "danger" : "success"}>
                          {fila.diferencia > 0 ? `+${fila.diferencia}` : `−${-fila.diferencia}`}{" "}
                          {Math.abs(fila.diferencia) === 1 ? "bulto" : "bultos"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 pr-5">
                      {renglon.nuevo ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/productos/alta">
                            <PackagePlus />
                            Dar de alta
                          </Link>
                        </Button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-2">
                            <Checkbox
                              id={`${costoId}-check`}
                              checked={fila.estado.cambioCosto}
                              onCheckedChange={(checked) => actualizar(renglon.id, { cambioCosto: checked === true })}
                              disabled={cargada}
                            />
                            <Label htmlFor={`${costoId}-check`} className="font-normal">
                              Cambió
                            </Label>
                          </span>
                          {fila.estado.cambioCosto && (
                            <>
                              <label htmlFor={costoId} className="sr-only">
                                Costo nuevo de la docena de {renglon.codigo}
                              </label>
                              <Input
                                id={costoId}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={100}
                                placeholder="Costo docena"
                                value={fila.estado.costoNuevo}
                                onChange={(event) => actualizar(renglon.id, { costoNuevo: event.target.value })}
                                className="h-8 w-32 tabular-nums"
                                aria-invalid={!(fila.costoNuevo && fila.costoNuevo > 0) || undefined}
                                disabled={cargada}
                              />
                              {fila.precioDespues !== null && fila.costoNuevo! > 0 && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                                  Bulto {formatCurrency(fila.precioAntes)}
                                  <ArrowRight aria-hidden className="size-3" />
                                  <span className="font-semibold text-foreground">
                                    {formatCurrency(fila.precioDespues)}
                                  </span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <CardFooter className="flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
          <span>
            Boleta <span className="font-medium text-foreground tabular-nums">{totalBoleta}</span> bultos
          </span>
          <span>
            Contados <span className="font-medium text-foreground tabular-nums">{totalContado}</span>
          </span>
          <span>
            Faltan{" "}
            <span className={cn("font-medium tabular-nums", faltantes.length ? "text-danger" : "text-foreground")}>
              {formatNumber(faltantes.reduce((sum, item) => sum + item.cantidad, 0))}
            </span>
          </span>
          <span>
            Sobran <span className="font-medium text-foreground tabular-nums">{sobrantes}</span>
          </span>
          {nuevos.length > 0 && (
            <span>
              Nuevos <span className="font-medium text-foreground tabular-nums">{nuevos.length}</span>
            </span>
          )}
        </CardFooter>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cierre de la carga</CardTitle>
              <CardDescription>
                La carga no está terminada hasta que costos y precios están al día y la firmó otra persona (RN-34,
                RN-37)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <ul className="space-y-3">
              {CHECKS.map((check) => {
                const id = `${uid}-check-${check.id}`;
                const noAplica = check.id === "faltantes" && faltantes.length === 0;
                return (
                  <li key={check.id} className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={noAplica || checks[check.id]}
                      disabled={noAplica || cargada}
                      onCheckedChange={(checked) =>
                        setChecks((actual) => ({ ...actual, [check.id]: checked === true }))
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor={id} className="leading-5 font-normal">
                      {check.label}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {check.regla}
                        {noAplica && " · no hubo faltantes"}
                      </span>
                    </Label>
                  </li>
                );
              })}
              <li className="flex items-start gap-3">
                <Checkbox id={`${uid}-real`} checked disabled className="mt-0.5" />
                <Label htmlFor={`${uid}-real`} className="leading-5 font-normal">
                  Se carga lo que llegó realmente, en bultos
                  <span className="ml-1.5 text-xs text-muted-foreground">RN-33 · automático</span>
                </Label>
              </li>
              <li className="flex items-start gap-3">
                <Checkbox id={`${uid}-costos`} checked={costosAlDia} disabled className="mt-0.5" />
                <Label htmlFor={`${uid}-costos`} className="leading-5 font-normal">
                  Costos y precios al día de lo que cambió
                  <span className="ml-1.5 text-xs text-muted-foreground">RN-34 · automático</span>
                </Label>
              </li>
            </ul>

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor={`${uid}-firma`}>Revisó y firmó</Label>
              <NativeSelect
                id={`${uid}-firma`}
                value={firmadoPor}
                onChange={(event) => setFirmadoPor(event.target.value)}
                disabled={cargada}
              >
                <option value="">Elegí quién revisa (no puede ser {recepcion.recibidoPor})</option>
                {recepcion.firmantes.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {tipo.label}: {tipo.reclamo.toLowerCase()} (RN-36). La boleta y el comprobante de DUX quedan adjuntos a
                la compra.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            {cargada ? (
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-success">
                <CircleCheck aria-hidden className="size-4" />
                Compra cargada en DUX y firmada por {firmadoPor}
              </p>
            ) : (
              <>
                {pendientes.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Para cerrar falta: {pendientes.map((item) => item.toLowerCase()).join(" · ")}.
                  </p>
                )}
                <Button onClick={cargar} disabled={cargando}>
                  {cargando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Upload />}
                  {cargando ? "Cargando…" : "Cargar la compra en DUX"}
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Mensaje al proveedor</CardTitle>
              <CardDescription>
                Los faltantes se avisan el mismo día o el siguiente. La app arma el mensaje con lo que se contó
              </CardDescription>
            </div>
            {mensaje && <CopyButton value={mensaje} label="Copiar el mensaje" successMessage="Mensaje copiado" />}
          </CardHeader>
          <CardContent className="pt-5">
            {mensaje ? (
              <>
                <Label htmlFor={`${uid}-mensaje`} className="sr-only">
                  Mensaje para {recepcion.proveedor}
                </Label>
                <Textarea
                  id={`${uid}-mensaje`}
                  value={mensaje}
                  onChange={(event) => setMensajeEditado(event.target.value)}
                  rows={8}
                />
                {mensajeEditado !== null && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setMensajeEditado(null)}>
                    Volver al mensaje sugerido
                  </Button>
                )}
              </>
            ) : (
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <CircleCheck aria-hidden className="size-4 text-success" />
                No hubo faltantes: no hace falta escribirle.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
