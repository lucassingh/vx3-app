"use client";

import { KeyRound, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Meter } from "@/components/kit/meter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { CredencialEnmascarada, IaConfig } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const usd = (value: number) => `US$ ${String(value).replace(".", ",")}`;

/* ---- API key y modelo ------------------------------------------------------- */

export function ModeloYKeyForm({ config, apiKeyLabel }: { config: IaConfig; apiKeyLabel: string | null }) {
  const router = useRouter();
  const [guardado, setGuardado] = useState(config.modelo);
  const [modelo, setModelo] = useState(config.modelo);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [keyLabel, setKeyLabel] = useState(apiKeyLabel);
  const [pending, startTransition] = useTransition();

  const base = config.modelos.find((item) => item.id === "claude-haiku-5-5") ?? config.modelos[0];
  const elegido = config.modelos.find((item) => item.id === modelo);
  const veces = elegido && base ? Math.round(elegido.costoMesUsd / base.costoMesUsd) : 1;

  const guardar = () => {
    startTransition(async () => {
      try {
        await api.plataforma.ia.actualizar({ modelo });
        setGuardado(modelo);
        toast.success(`El bot va a usar ${elegido?.nombre}`, {
          description: "Antes de publicarse se prueba contra el set de conversaciones reales.",
        });
        router.refresh();
      } catch {
        toast.error("No se pudo cambiar el modelo", { action: { label: "Reintentar", onClick: guardar } });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground shadow-card">
          <KeyRound aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">API key de la cuenta de VX3</p>
          <p className="truncate text-xs text-muted-foreground">
            {apiKey ? (
              <>
                <span className="font-mono text-foreground">{apiKey.mascara}</span>
                {keyLabel && ` · ${keyLabel}`}
              </>
            ) : (
              "Todavía no hay una key cargada"
            )}
          </p>
        </div>
        <KeyDialog
          tipo="api"
          trigger={apiKey ? "Reemplazar" : "Cargar API key"}
          onSaved={(credencial) => {
            setApiKey(credencial);
            setKeyLabel(`${credencial.cargadaPor} · recién`);
            router.refresh();
          }}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Modelo del bot</legend>
        <p className="mt-1 text-[13px] text-muted-foreground">
          La evaluación arranca por Haiku. Si un tipo de caso no llega a la vara de calidad, solo ese caso pasa a un modelo mayor.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {config.modelos.map((item) => (
            <label key={item.id} className="group cursor-pointer">
              <input
                type="radio"
                name="modelo"
                value={item.id}
                checked={modelo === item.id}
                onChange={() => setModelo(item.id)}
                className="peer sr-only"
              />
              <span className="flex h-full flex-col gap-2 rounded-xl border border-border p-4 transition-[border-color,box-shadow] duration-150 group-hover:border-border-strong peer-checked:border-primary peer-checked:ring-[3px] peer-checked:ring-primary/15 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.nombre}</span>
                  {item.id === guardado && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium">En uso</span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{item.id}</span>
                <span className="text-pretty text-[13px] text-muted-foreground">{item.descripcion}</span>
                <span className="mt-auto pt-1 text-sm tabular-nums">
                  ~{usd(item.costoMesUsd)} <span className="text-xs text-muted-foreground">por mes</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className={cn("flex items-center gap-1.5 text-[13px]", veces > 1 ? "text-warning" : "text-muted-foreground")}>
          {veces > 1 ? (
            <>
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              Cuesta unas {veces} veces más por mes que Haiku.
            </>
          ) : (
            "Estimación con 200 conversaciones por día y caché del prompt."
          )}
        </p>
        <Button onClick={guardar} disabled={pending || modelo === guardado}>
          {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save />}
          Guardar modelo
        </Button>
      </div>
    </div>
  );
}

/* ---- Cargar o reemplazar una key ------------------------------------------- */

function KeyDialog({
  tipo,
  trigger,
  onSaved,
}: {
  tipo: "api" | "admin";
  trigger: string;
  onSaved: (credencial: CredencialEnmascarada) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prefix = tipo === "admin" ? "sk-ant-admin" : "sk-ant-";

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!key.trim().startsWith(prefix)) {
      setError(`La key empieza con ${prefix}.`);
      return;
    }
    startTransition(async () => {
      try {
        const credencial = await api.plataforma.ia.cargarKey({ tipo, key: key.trim() });
        toast.success(tipo === "admin" ? "Admin API key cargada" : "API key reemplazada", {
          description: "Se guardó cifrada: solo se muestran los últimos 4 caracteres.",
        });
        onSaved(credencial);
        setKey("");
        setError(null);
        setOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar la key.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setKey("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{tipo === "admin" ? "Admin API key de Anthropic" : "API key de Anthropic"}</DialogTitle>
            <DialogDescription>
              {tipo === "admin"
                ? "Sirve solo para traer el reporte oficial de costos. Se crea en console.anthropic.com con un usuario administrador."
                : "La key es de la cuenta de VX3 y su consumo lo factura Anthropic a VX3. La anterior deja de usarse al guardar."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <Label htmlFor={id}>Nueva key</Label>
            <Input
              id={id}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={`${prefix}…`}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="font-mono"
            />
            {error && (
              <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !key}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              {pending ? "Guardando…" : "Guardar key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Tope de gasto ---------------------------------------------------------- */

export function TopeGastoForm({
  tope,
  alertaPct,
  gasto,
  gastoLabel,
}: {
  tope: number;
  alertaPct: number;
  gasto: number;
  gastoLabel: string;
}) {
  const id = useId();
  const [valor, setValor] = useState(String(tope));
  const [alerta, setAlerta] = useState(String(Math.round(alertaPct * 100)));
  const [guardado, setGuardado] = useState({ tope, alerta: String(Math.round(alertaPct * 100)) });
  const [pending, startTransition] = useTransition();

  const topeNumero = Number(valor);
  const valido = Number.isFinite(topeNumero) && topeNumero > 0;
  const actual = valido ? topeNumero : guardado.tope;
  const ratio = gasto / actual;
  const tone = ratio >= 1 ? "danger" : ratio >= Number(alerta) / 100 ? "warning" : "success";
  const cambio = valido && (topeNumero !== guardado.tope || alerta !== guardado.alerta);

  const guardar = () => {
    startTransition(async () => {
      try {
        await api.plataforma.ia.actualizar({ topeMensualUsd: topeNumero, alertaPct: Number(alerta) / 100 });
        setGuardado({ tope: topeNumero, alerta });
        toast.success("Tope de gasto actualizado", {
          description: `Te avisamos al llegar al ${alerta} % de ${usd(topeNumero)}.`,
        });
      } catch {
        toast.error("No se pudo guardar el tope", { action: { label: "Reintentar", onClick: guardar } });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Gastado en 30 días</span>
          <span className="tabular-nums">
            <span className="font-medium">{gastoLabel}</span>
            <span className="text-muted-foreground"> de {usd(actual)}</span>
          </span>
        </p>
        <Meter
          value={gasto}
          max={actual}
          tone={tone}
          label="Gasto contra el tope mensual"
          valueText={`${gastoLabel} de ${usd(actual)}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-tope`}>Tope mensual</Label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              US$
            </span>
            <Input
              id={`${id}-tope`}
              inputMode="numeric"
              value={valor}
              onChange={(event) => setValor(event.target.value.replace(/\D/g, ""))}
              aria-invalid={!valido || undefined}
              className="pl-11 tabular-nums"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-alerta`}>Avisar al llegar al</Label>
          <NativeSelect id={`${id}-alerta`} value={alerta} onChange={(event) => setAlerta(event.target.value)}>
            {["70", "80", "90"].map((value) => (
              <option key={value} value={value}>
                {value} % del tope
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">El aviso llega por la app y por WhatsApp a los socios.</p>
        <Button size="sm" onClick={guardar} disabled={pending || !cambio}>
          {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

/* ---- Admin API key ---------------------------------------------------------- */

export function AdminKeyForm({ adminKey, label }: { adminKey: CredencialEnmascarada | null; label: string | null }) {
  const router = useRouter();
  const [credencial, setCredencial] = useState(adminKey);
  const [texto, setTexto] = useState(label);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        {credencial ? (
          <>
            <p className="truncate font-mono text-sm">{credencial.mascara}</p>
            <p className="text-xs text-muted-foreground">{texto} · se concilia cada noche</p>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sin cargar. El consumo se mide igual con lo que devuelve cada respuesta.</p>
        )}
      </div>
      <KeyDialog
        tipo="admin"
        trigger={credencial ? "Reemplazar" : "Cargar Admin key"}
        onSaved={(nueva) => {
          setCredencial(nueva);
          setTexto(`${nueva.cargadaPor} · recién`);
          router.refresh();
        }}
      />
    </div>
  );
}
