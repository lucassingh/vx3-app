"use client";

import { ArrowRight, Info, LoaderCircle, Save, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import { describirValorRegla, validarRegla, valorParaCampo } from "@/lib/api/contracts/plataforma";
import type { ReglaGrupo, ReglaNegocio, ReglaValor } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CodeTag } from "./shared";

export const GRUPOS: { id: ReglaGrupo; label: string; descripcion: string }[] = [
  {
    id: "precios",
    label: "Productos y precios",
    descripcion: "El motor de precios, el control de margen y el generador de combos.",
  },
  {
    id: "pedidos",
    label: "Pedidos y facturación",
    descripcion: "Lo que validan el bot, la vidriera y la facturación por API.",
  },
  { id: "envios", label: "Envíos", descripcion: "Tarifas, embalajes y cortes horarios del cotizador y del despacho." },
  { id: "cobros", label: "Cobros", descripcion: "Plazos de la conciliación y del corte semanal con Transtech." },
  { id: "postventa", label: "Post-venta", descripcion: "Plazos, evidencia y resoluciones de los reclamos." },
  {
    id: "bot",
    label: "Bot y recuperación",
    descripcion: "La secuencia de seguimiento de los pedidos trabados y la derivación.",
  },
  { id: "pauta", label: "Pauta", descripcion: "Conversión del gasto, semáforo de anuncios y atribución." },
];

/** Etiquetas armadas en el servidor: "hace 2 días · Elías Llaury" y "18 oct". */
export type ReglaLabels = Record<string, { ultimo: string; vigencia: string }>;

type Draft = string | boolean;

/** Lo que muestra el campo para el valor guardado. */
function draftDe(regla: ReglaNegocio): Draft {
  if (regla.tipo === "booleano") return Boolean(regla.valor);
  return valorParaCampo(regla.tipo, regla.valor);
}

/** Texto del campo → valor de la regla. */
function parse(regla: ReglaNegocio, draft: Draft): ReglaValor {
  if (typeof draft === "boolean") return draft;
  const raw = draft.trim();
  if (raw === "") return null;
  switch (regla.tipo) {
    case "moneda":
    case "numero":
      return Number(raw.replace(/\D/g, ""));
    case "coeficiente":
    case "porcentaje":
      return Number(raw.replace(",", "."));
    default:
      return raw;
  }
}

export function ReglasEditor({
  initialReglas,
  initialLabels,
}: {
  initialReglas: ReglaNegocio[];
  initialLabels: ReglaLabels;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [reglas, setReglas] = useState(initialReglas);
  const [labels, setLabels] = useState(initialLabels);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const cambios = useMemo(
    () =>
      reglas.flatMap((regla) => {
        const draft = drafts[regla.id];
        if (draft === undefined) return [];
        const valor = parse(regla, draft);
        const antes = describirValorRegla(regla, regla.valor);
        const despues = describirValorRegla(regla, valor);
        if (antes === despues) return [];
        return [{ regla, valor, antes, despues, error: validarRegla(regla, valor) }];
      }),
    [reglas, drafts],
  );
  const conError = cambios.filter((cambio) => cambio.error).length;
  const porGrupo = (grupo: ReglaGrupo) => cambios.filter((cambio) => cambio.regla.grupo === grupo).length;

  const setDraft = (id: string, value: Draft) => setDrafts((current) => ({ ...current, [id]: value }));
  const descartar = () => setDrafts({});

  const guardar = () => {
    startTransition(async () => {
      try {
        const result = await api.plataforma.reglas.actualizar(
          cambios.map(({ regla, valor }) => ({ id: regla.id, valor })),
        );
        const cambiadas = new Set(result.cambios.map((cambio) => cambio.reglaId));
        setReglas(result.reglas);
        setLabels((current) => {
          const next = { ...current };
          for (const id of cambiadas) next[id] = { ultimo: `recién · ${currentUser.name}`, vigencia: "hoy" };
          return next;
        });
        setDrafts({});
        setConfirming(false);
        toast.success(
          result.cambios.length === 1 ? "Regla actualizada" : `${result.cambios.length} reglas actualizadas`,
          { description: "Rigen desde hoy y quedaron en el historial con tu nombre." },
        );
        router.refresh();
      } catch (error) {
        toast.error("No se pudieron guardar los cambios", {
          description: error instanceof Error ? error.message : "Revisá la conexión e intentá de nuevo.",
          action: { label: "Reintentar", onClick: guardar },
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="precios">
        <TabsList aria-label="Grupos de reglas" className="w-full justify-start sm:w-auto">
          {GRUPOS.map((grupo) => {
            const modificadas = porGrupo(grupo.id);
            return (
              <TabsTrigger key={grupo.id} value={grupo.id}>
                {grupo.label}
                {modificadas > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {modificadas}
                    <span className="sr-only"> sin guardar</span>
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {GRUPOS.map((grupo) => (
          <TabsContent key={grupo.id} value={grupo.id} className="mt-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-4">
                <div>
                  <CardTitle>{grupo.label}</CardTitle>
                  <CardDescription>{grupo.descripcion}</CardDescription>
                </div>
              </CardHeader>
              <ul className="divide-y divide-border border-t border-border">
                {reglas
                  .filter((regla) => regla.grupo === grupo.id)
                  .map((regla) => {
                    const draft = drafts[regla.id] ?? draftDe(regla);
                    const cambio = cambios.find((item) => item.regla.id === regla.id);
                    return (
                      <ReglaRow
                        key={regla.id}
                        regla={regla}
                        draft={draft}
                        modificada={Boolean(cambio)}
                        error={cambio?.error ?? null}
                        label={labels[regla.id]}
                        onChange={(value) => setDraft(regla.id, value)}
                      />
                    );
                  })}
              </ul>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <AnimatePresence>
        {cambios.length > 0 && (
          <motion.div
            key="barra"
            role="region"
            aria-label="Cambios sin guardar"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
            className="sticky bottom-4 z-20 mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-popover px-4 py-3 shadow-popover"
          >
            <p aria-live="polite" className="text-sm">
              <span className="font-medium">
                {cambios.length} {cambios.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}
              </span>
              {conError > 0 && <span className="text-danger"> · {conError} con error</span>}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={descartar}>
                <Undo2 />
                Descartar
              </Button>
              <Button size="sm" disabled={conError > 0} onClick={() => setConfirming(true)}>
                <Save />
                Guardar cambios
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisá los cambios</DialogTitle>
            <DialogDescription>
              Rigen desde hoy para el bot y todos los módulos, y quedan en el historial con tu nombre.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="divide-y divide-border">
              {cambios.map(({ regla, antes, despues }) => (
                <li key={regla.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {regla.nombre}
                    <CodeTag>{regla.codigo}</CodeTag>
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                      <span className="sr-only">Antes: </span>
                      {antes}
                    </span>
                    <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      <span className="sr-only">Después: </span>
                      {despues}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Volver
            </Button>
            <Button onClick={guardar} disabled={pending}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              {pending ? "Guardando…" : "Confirmar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReglaRow({
  regla,
  draft,
  modificada,
  error,
  label,
  onChange,
}: {
  regla: ReglaNegocio;
  draft: Draft;
  modificada: boolean;
  error: string | null;
  label?: { ultimo: string; vigencia: string };
  onChange: (value: Draft) => void;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const errorId = `${id}-error`;

  return (
    <li
      className={cn(
        "grid gap-x-6 gap-y-3 px-5 py-4 transition-colors md:grid-cols-[minmax(0,1fr)_15rem] md:items-center xl:grid-cols-[minmax(0,1fr)_15rem_11rem]",
        modificada && "bg-primary/4",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            {regla.nombre}
          </label>
          <CodeTag>{regla.codigo}</CodeTag>
          {regla.aConfirmar && (
            <Badge variant="warning" dot>
              A confirmar
            </Badge>
          )}
          {modificada && <Badge variant="primary">Modificada</Badge>}
        </div>
        {regla.descripcion && (
          <p id={descId} className="text-[13px] text-pretty text-muted-foreground">
            {regla.descripcion}
          </p>
        )}
        {regla.nota && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />
            {regla.nota}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <ReglaCampo
          id={id}
          regla={regla}
          draft={draft}
          invalid={Boolean(error)}
          describedBy={
            [regla.descripcion ? descId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
          }
          onChange={onChange}
        />
        {error && (
          <p id={errorId} className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground xl:text-right">
        {label ? (
          <>
            Vigente desde {label.vigencia}
            <br className="hidden xl:block" />
            <span className="xl:hidden"> · </span>
            {label.ultimo}
          </>
        ) : null}
      </p>
    </li>
  );
}

function ReglaCampo({
  id,
  regla,
  draft,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  regla: ReglaNegocio;
  draft: Draft;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: Draft) => void;
}) {
  const aria = { "aria-invalid": invalid || undefined, "aria-describedby": describedBy };

  if (regla.tipo === "booleano") {
    return (
      <div className="flex h-9 items-center gap-3">
        <Switch id={id} checked={Boolean(draft)} onCheckedChange={onChange} {...aria} />
        <span className="text-sm text-muted-foreground">{draft ? "Activada" : "Desactivada"}</span>
      </div>
    );
  }

  if (regla.tipo === "seleccion") {
    return (
      <NativeSelect id={id} value={String(draft)} onChange={(event) => onChange(event.target.value)} {...aria}>
        {regla.opciones?.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </NativeSelect>
    );
  }

  if (regla.tipo === "hora") {
    return (
      <Input
        id={id}
        type="time"
        value={String(draft)}
        onChange={(event) => onChange(event.target.value)}
        className="tabular-nums"
        {...aria}
      />
    );
  }

  if (regla.tipo === "texto") {
    return <Input id={id} value={String(draft)} onChange={(event) => onChange(event.target.value)} {...aria} />;
  }

  const prefix = regla.tipo === "moneda" ? "$" : regla.tipo === "coeficiente" ? "×" : null;
  const suffix = regla.tipo === "porcentaje" ? "%" : regla.tipo === "numero" ? regla.unidad : null;
  const enteros = regla.tipo === "moneda" || regla.tipo === "numero";

  return (
    <div className="relative">
      {prefix && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {prefix}
        </span>
      )}
      <Input
        id={id}
        inputMode={enteros ? "numeric" : "decimal"}
        autoComplete="off"
        value={String(draft)}
        placeholder={regla.aConfirmar ? "Sin definir" : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          if (!enteros) return onChange(raw.replace(/[^\d.,]/g, ""));
          const digits = raw.replace(/\D/g, "");
          onChange(digits ? valorParaCampo("moneda", Number(digits)) : "");
        }}
        className={cn("tabular-nums", prefix && "pl-7", suffix && "pr-16")}
        {...aria}
      />
      {suffix && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
