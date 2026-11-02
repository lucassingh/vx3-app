"use client";

import {
  Ban,
  History,
  Lock,
  MessageSquareQuote,
  Plus,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect, Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api/browser";
import type { BotConfig, MedioPago, Transporte, Zona } from "@/lib/api/types";
import { MEDIO_PAGO, TRANSPORTE, ZONA } from "@/lib/domain";
import { formatPercent } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Probador } from "./probador";

type Editable = Omit<BotConfig, "versiones" | "generadoEn">;

export type VersionesView = {
  publicada: { numero: number; cuando: string; por: string; acierto: string };
  borrador: { numero: number; cuando: string; por: string; cambios: string[] } | null;
  historial: { numero: number; cuando: string; por: string; resumen: string; acierto: string }[];
};

const RESPONSABLES = ["Lucía · post-venta", "Leo · ventas", "Leo · cobros", "Elías", "Juan · compras"];

const ZONAS: Zona[] = ["amba_1", "amba_2", "interior"];
const TRANSPORTES: Transporte[] = ["mensajeria", "correo", "via_cargo", "retira"];

const pct = (value: number) => formatPercent(value, { maximumFractionDigits: 0 });

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Lista editable de textos cortos (ejemplos de tono, límites). */
function TextList({
  id,
  label,
  items,
  onChange,
  placeholder,
  tone = "neutral",
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-[13px] font-medium">{label}</legend>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className={
              tone === "success"
                ? "flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[13px]"
                : tone === "danger"
                  ? "flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px]"
                  : "flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px]"
            }
          >
            <span className="min-w-0 flex-1 leading-relaxed">{item}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Quitar “${item}”`}
              onClick={() => onChange(items.filter((_, position) => position !== index))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Label htmlFor={id} className="sr-only">
          Agregar a {label.toLowerCase()}
        </Label>
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus />
          Agregar
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * Consola de configuración del bot (RF-M3-07): los socios editan tono, reglas,
 * preguntas, palancas, derivación y límites. Cada cambio queda en un borrador
 * versionado; publicar corre antes el set de evaluación (RF-M3-10).
 */
export function ConfigEditor({ initial, versiones: initialVersiones }: { initial: Editable; versiones: VersionesView }) {
  const [config, setConfig] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [versiones, setVersiones] = useState(initialVersiones);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(saved), [config, saved]);
  const borradorNumero = versiones.borrador?.numero ?? versiones.publicada.numero + 1;

  const update = <K extends keyof Editable>(key: K, value: Editable[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const updateReglas = (patch: Partial<Editable["reglas"]>) =>
    setConfig((current) => ({ ...current, reglas: { ...current.reglas, ...patch } }));
  const updateIdentidad = (patch: Partial<Editable["identidad"]>) =>
    setConfig((current) => ({ ...current, identidad: { ...current.identidad, ...patch } }));

  const guardar = () =>
    api.bot.guardarBorrador(config).then((result) => {
      setSaved(config);
      setVersiones((current) => ({
        ...current,
        borrador: {
          numero: result.versiones.borrador?.numero ?? borradorNumero,
          cuando: "recién",
          por: "Elías",
          cambios: result.versiones.borrador?.cambios ?? [],
        },
      }));
      return result;
    });

  const onGuardar = () => {
    startTransition(async () => {
      await toast
        .promise(guardar(), {
          loading: "Guardando el borrador…",
          success: `Borrador v${borradorNumero} guardado`,
          error: (error: Error) => error.message || "No se pudo guardar el borrador",
        })
        .unwrap()
        .catch(() => {});
    });
  };

  const onPublicar = () => {
    startTransition(async () => {
      const publicar = (dirty ? guardar() : Promise.resolve(null)).then(() => api.bot.publicar());
      try {
        const resultado = await toast
          .promise(publicar, {
            loading: "Corriendo el set de evaluación con 412 conversaciones reales…",
            success: (r) => `Versión ${r.numero} publicada · ${r.aprobados} de ${r.casos} casos bien (${pct(r.acierto)})`,
            error: "No se pudo publicar: la versión publicada sigue igual",
          })
          .unwrap();
        setVersiones((current) => ({
          publicada: { numero: resultado.numero, cuando: "recién", por: "Elías", acierto: pct(resultado.acierto) },
          borrador: null,
          historial: [
            {
              numero: resultado.numero,
              cuando: "recién",
              por: "Elías",
              resumen: current.borrador?.cambios[0] ?? "Ajustes de configuración",
              acierto: pct(resultado.acierto),
            },
            ...current.historial,
          ],
        }));
      } catch {
        // El aviso de error ya lo muestra toast.promise.
      }
    });
  };

  const { identidad, reglas } = config;
  const pagosDe = (transporte: Transporte, zona: Zona): MedioPago[] =>
    reglas.matriz.find((celda) => celda.transporte === transporte && celda.zona === zona)?.pagos ?? [];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>{identidad.nombre || "Asistente"}</CardTitle>
            <CardDescription>
              {versiones.borrador || dirty ? (
                <>Estás editando el borrador de la versión {borradorNumero}. La versión {versiones.publicada.numero} sigue atendiendo.</>
              ) : (
                <>Sin cambios pendientes: atiende la versión {versiones.publicada.numero}.</>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <Badge variant="warning" dot>
                Cambios sin guardar
              </Badge>
            )}
            <Button variant="outline" onClick={onGuardar} disabled={!dirty || pending}>
              <Save />
              Guardar borrador
            </Button>
            <Button onClick={onPublicar} disabled={pending || (!dirty && !versiones.borrador)}>
              <Rocket />
              Publicar versión {borradorNumero}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <Tabs defaultValue="identidad">
            <TabsList aria-label="Secciones de la configuración" className="w-full justify-start sm:w-auto">
              <TabsTrigger value="identidad">Identidad y tono</TabsTrigger>
              <TabsTrigger value="reglas">Reglas comerciales</TabsTrigger>
              <TabsTrigger value="preguntas">Preguntas frecuentes</TabsTrigger>
              <TabsTrigger value="palancas">Palancas de cierre</TabsTrigger>
              <TabsTrigger value="derivacion">Derivación</TabsTrigger>
              <TabsTrigger value="limites">Límites</TabsTrigger>
            </TabsList>

            {/* ---- Identidad y tono ---- */}
            <TabsContent value="identidad" className="space-y-6 pt-6">
              <div className="grid gap-5 md:grid-cols-3">
                <Field id="bot-nombre" label="Nombre del asistente" hint="Así se presenta con las clientas.">
                  <Input id="bot-nombre" value={identidad.nombre} onChange={(event) => updateIdentidad({ nombre: event.target.value })} />
                </Field>
                <Field id="bot-trato" label="Trato">
                  <NativeSelect id="bot-trato" value={identidad.trato} onChange={(event) => updateIdentidad({ trato: event.target.value as "vos" | "usted" })}>
                    <option value="vos">Vos (cercano)</option>
                    <option value="usted">Usted (formal)</option>
                  </NativeSelect>
                </Field>
                <Field id="bot-emojis" label="Emojis">
                  <NativeSelect
                    id="bot-emojis"
                    value={identidad.emojis}
                    onChange={(event) => updateIdentidad({ emojis: event.target.value as Editable["identidad"]["emojis"] })}
                  >
                    <option value="nunca">Nunca</option>
                    <option value="pocos">Pocos, al cerrar una idea</option>
                    <option value="libres">Libres</option>
                  </NativeSelect>
                </Field>
              </div>
              <Field id="bot-guia" label="Guía de tono" hint="La lee el bot antes de cada respuesta.">
                <Textarea id="bot-guia" rows={3} value={identidad.guia} onChange={(event) => updateIdentidad({ guia: event.target.value })} />
              </Field>
              <div className="grid gap-6 lg:grid-cols-2">
                <TextList
                  id="bot-suena"
                  label="Suena a VX3"
                  items={identidad.suena}
                  tone="success"
                  placeholder="Un ejemplo de cómo sí"
                  onChange={(suena) => updateIdentidad({ suena })}
                />
                <TextList
                  id="bot-no-suena"
                  label="No suena a VX3"
                  items={identidad.noSuena}
                  tone="danger"
                  placeholder="Un ejemplo de cómo no"
                  onChange={(noSuena) => updateIdentidad({ noSuena })}
                />
              </div>
            </TabsContent>

            {/* ---- Reglas comerciales ---- */}
            <TabsContent value="reglas" className="space-y-6 pt-6">
              <p className="rounded-lg bg-muted px-3.5 py-2.5 text-[13px] text-muted-foreground">
                Son campos con tipo, no texto libre: las aplica el sistema y el bot no las puede saltear aunque se lo pidan.
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field id="bot-minimo" label="Pedido mínimo, sin envío" hint="Si no llega, el bot dice cuánto falta exacto.">
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      id="bot-minimo"
                      type="number"
                      min={1}
                      step={500}
                      inputMode="numeric"
                      className="pl-7 tabular-nums"
                      value={reglas.pedidoMinimo}
                      onChange={(event) => updateReglas({ pedidoMinimo: Number(event.target.value) })}
                    />
                  </div>
                </Field>
                <Field id="bot-sena" label="Seña para retirar por el local" hint="Porcentaje del total.">
                  <div className="relative">
                    <Input
                      id="bot-sena"
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      className="pr-8 tabular-nums"
                      value={Math.round(reglas.senaRetiro * 100)}
                      onChange={(event) => updateReglas({ senaRetiro: Number(event.target.value) / 100 })}
                    />
                    <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </Field>
                <Field id="bot-corte" label="Corte para despachar hoy en AMBA" hint="Lo usa la palanca “Despacho hoy”.">
                  <Input id="bot-corte" type="time" value={reglas.corteDespachoAmba} onChange={(event) => updateReglas({ corteDespachoAmba: event.target.value })} />
                </Field>
                <Field id="bot-desde" label="Atiende desde">
                  <Input id="bot-desde" type="time" value={reglas.horarioDesde} onChange={(event) => updateReglas({ horarioDesde: event.target.value })} />
                </Field>
                <Field id="bot-hasta" label="Atiende hasta" hint="Fuera de horario responde y deja el resumen para el equipo.">
                  <Input id="bot-hasta" type="time" value={reglas.horarioHasta} onChange={(event) => updateReglas({ horarioHasta: event.target.value })} />
                </Field>
                <Field id="bot-dias" label="Días">
                  <Input id="bot-dias" value={reglas.diasAtencion} onChange={(event) => updateReglas({ diasAtencion: event.target.value })} />
                </Field>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-[13px] font-medium">Medios de pago que ofrece</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {reglas.mediosPago.map((medio) => (
                    <div key={medio.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                      <Label htmlFor={`pago-${medio.id}`} className="font-normal">
                        {MEDIO_PAGO[medio.id]}
                      </Label>
                      <Switch
                        id={`pago-${medio.id}`}
                        checked={medio.activo}
                        onCheckedChange={(activo) =>
                          updateReglas({
                            mediosPago: reglas.mediosPago.map((item) => (item.id === medio.id ? { ...item, activo } : item)),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-medium">Qué pago acepta cada envío</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock aria-hidden className="size-3.5" />
                    Regla fija: la contraentrega es solo en AMBA y con mensajería (RN-29)
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table className="min-w-xl">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transporte</TableHead>
                        {ZONAS.map((zona) => (
                          <TableHead key={zona}>{ZONA[zona].label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {TRANSPORTES.map((transporte) => (
                        <TableRow key={transporte}>
                          <TableCell className="font-medium">{TRANSPORTE[transporte]}</TableCell>
                          {ZONAS.map((zona) => {
                            const pagos = pagosDe(transporte, zona);
                            return (
                              <TableCell key={zona}>
                                {pagos.length === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Ban aria-hidden className="size-3.5" />
                                    No se ofrece
                                  </span>
                                ) : (
                                  <span className="flex flex-wrap gap-1">
                                    {pagos.map((pago) => (
                                      <Badge key={pago} variant={pago === "contraentrega" ? "accent" : "outline"}>
                                        {MEDIO_PAGO[pago]}
                                      </Badge>
                                    ))}
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vía Cargo: la clienta paga el flete al retirar. Retiro por el local: seña del {Math.round(reglas.senaRetiro * 100)} %.
                </p>
              </div>
            </TabsContent>

            {/* ---- Preguntas frecuentes ---- */}
            <TabsContent value="preguntas" className="space-y-4 pt-6">
              <p className="text-[13px] text-muted-foreground">
                Respuestas aprobadas: el bot las usa tal cual, adaptando solo el saludo.
              </p>
              <ul className="space-y-3">
                {config.preguntas.map((faq, index) => (
                  <li key={faq.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor={`${faq.id}-pregunta`}>Pregunta {index + 1}</Label>
                        <Input
                          id={`${faq.id}-pregunta`}
                          value={faq.pregunta}
                          onChange={(event) =>
                            update("preguntas", config.preguntas.map((item) => (item.id === faq.id ? { ...item, pregunta: event.target.value } : item)))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar la pregunta “${faq.pregunta}”`}
                        onClick={() => update("preguntas", config.preguntas.filter((item) => item.id !== faq.id))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${faq.id}-respuesta`}>Respuesta aprobada</Label>
                      <Textarea
                        id={`${faq.id}-respuesta`}
                        rows={2}
                        value={faq.respuesta}
                        onChange={(event) =>
                          update("preguntas", config.preguntas.map((item) => (item.id === faq.id ? { ...item, respuesta: event.target.value } : item)))
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  update("preguntas", [...config.preguntas, { id: `fq-${Date.now()}`, pregunta: "", respuesta: "" }])
                }
              >
                <Plus />
                Agregar pregunta
              </Button>
            </TabsContent>

            {/* ---- Palancas ---- */}
            <TabsContent value="palancas" className="space-y-6 pt-6">
              <p className="text-[13px] text-muted-foreground">
                Para los pedidos trabados: el bot usa una sola palanca por mensaje y nunca repite el mismo texto.
              </p>
              <div className="grid gap-4 lg:grid-cols-3">
                {config.palancas.map((palanca) => (
                  <div key={palanca.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`${palanca.id}-activa`} className="text-sm font-semibold">
                        {palanca.nombre}
                      </Label>
                      <Switch
                        id={`${palanca.id}-activa`}
                        checked={palanca.activa}
                        onCheckedChange={(activa) =>
                          update("palancas", config.palancas.map((item) => (item.id === palanca.id ? { ...item, activa } : item)))
                        }
                      />
                    </div>
                    <Field id={`${palanca.id}-condicion`} label="Cuándo se usa">
                      <Textarea
                        id={`${palanca.id}-condicion`}
                        rows={2}
                        value={palanca.condicion}
                        onChange={(event) =>
                          update("palancas", config.palancas.map((item) => (item.id === palanca.id ? { ...item, condicion: event.target.value } : item)))
                        }
                      />
                    </Field>
                    <Field id={`${palanca.id}-ejemplo`} label="Texto de ejemplo">
                      <Textarea
                        id={`${palanca.id}-ejemplo`}
                        rows={2}
                        value={palanca.ejemplo}
                        onChange={(event) =>
                          update("palancas", config.palancas.map((item) => (item.id === palanca.id ? { ...item, ejemplo: event.target.value } : item)))
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-[13px] font-medium">Secuencia de seguimiento</h3>
                <ol className="grid gap-3 md:grid-cols-4">
                  {config.secuencia.map((paso, index) => (
                    <li key={paso.paso} className="relative rounded-lg border border-border bg-muted/30 p-3.5">
                      <p className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
                          {index + 1}
                        </span>
                        {paso.paso}
                      </p>
                      <p className="mt-1.5 text-xs font-medium">{paso.cuando}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{paso.accion}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </TabsContent>

            {/* ---- Derivación ---- */}
            <TabsContent value="derivacion" className="space-y-4 pt-6">
              <p className="text-[13px] text-muted-foreground">
                La derivación clara es requisito de Meta. La conversación pasa a la bandeja con un resumen, y la persona elige el motivo al tomarla.
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {config.derivacion.map((regla) => (
                  <li key={regla.id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
                    <p className="text-[13px] font-medium">{regla.cuando}</p>
                    <div>
                      <Label htmlFor={`${regla.id}-a`} className="sr-only">
                        Deriva a
                      </Label>
                      <NativeSelect
                        id={`${regla.id}-a`}
                        value={regla.a}
                        onChange={(event) =>
                          update("derivacion", config.derivacion.map((item) => (item.id === regla.id ? { ...item, a: event.target.value } : item)))
                        }
                      >
                        {RESPONSABLES.map((responsable) => (
                          <option key={responsable} value={responsable}>
                            {responsable}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <Switch
                      aria-label={`Derivar cuando: ${regla.cuando}`}
                      checked={regla.activa}
                      onCheckedChange={(activa) =>
                        update("derivacion", config.derivacion.map((item) => (item.id === regla.id ? { ...item, activa } : item)))
                      }
                    />
                  </li>
                ))}
              </ul>
            </TabsContent>

            {/* ---- Límites ---- */}
            <TabsContent value="limites" className="space-y-4 pt-6">
              <TextList
                id="bot-limites"
                label="Lo que el bot nunca hace"
                items={config.limites}
                placeholder="Agregar un límite"
                onChange={(limites) => update("limites", limites)}
              />
              <p className="text-xs text-muted-foreground">
                Precio, stock, fotos y corte de despacho salen siempre de los sistemas, nunca de la memoria del modelo.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="space-y-6 xl:sticky xl:top-20">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <History aria-hidden className="size-4 text-muted-foreground" />
                Versiones
              </CardTitle>
              <CardDescription>Cada publicación queda registrada con su acierto</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-lg border border-primary/30 bg-primary/8 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Versión {versiones.publicada.numero}</p>
                <Badge variant="success" dot>
                  Publicada
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground first-letter:uppercase">
                {versiones.publicada.cuando} · {versiones.publicada.por} · acierto {versiones.publicada.acierto}
              </p>
            </div>
            {versiones.borrador && (
              <div className="rounded-lg border border-dashed border-border-strong p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Versión {versiones.borrador.numero}</p>
                  <Badge variant="warning" dot>
                    Borrador
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground first-letter:uppercase">
                  Editado {versiones.borrador.cuando} · {versiones.borrador.por}
                </p>
                <ul className="mt-2 space-y-1">
                  {versiones.borrador.cambios.map((cambio) => (
                    <li key={cambio} className="flex gap-1.5 text-xs">
                      <MessageSquareQuote aria-hidden className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                      {cambio}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter className="block px-0 py-0">
            <ol className="divide-y divide-border">
              {versiones.historial.map((version) => (
                <li key={`${version.numero}-${version.cuando}`} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">
                      v{version.numero} · {version.resumen}
                    </p>
                    <p className="text-xs text-muted-foreground first-letter:uppercase">
                      {version.cuando} · {version.por}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{version.acierto}</span>
                </li>
              ))}
            </ol>
          </CardFooter>
        </Card>

        <Probador nombre={identidad.nombre || "Asistente VX3"} />
      </div>
    </div>
  );
}
