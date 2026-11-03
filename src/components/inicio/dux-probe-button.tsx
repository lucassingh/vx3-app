"use client";
/* eslint-disable no-console -- PROVISORIO: el sondeo de DUX muestra las respuestas en la consola; se borra en la fase 1.4. */

import { ChevronDown, Copy, FlaskConical } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DuxProbeKey, type DuxProbeResult, probeDux } from "@/lib/dux/probe-action";
import { toast } from "@/lib/toast";

const OPTIONS: { key: DuxProbeKey; label: string; hint: string }[] = [
  { key: "stock", label: "Stock", hint: "GET /v2/stock · depósito Temperley · 50" },
  { key: "items", label: "Items", hint: "GET /v2/items · 3 productos" },
  { key: "facturas", label: "Facturas", hint: "GET /facturas (v1) · últimos 7 días" },
];

/**
 * PROVISORIO (30/10): consulta la API real de DUX (un request por vez) y
 * muestra la respuesta en un panel lateral y en la consola. Solo se ve en
 * desarrollo (ver page.tsx).
 */
export function DuxProbeButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DuxProbeResult | null>(null);

  const run = (key: DuxProbeKey) => {
    startTransition(async () => {
      const id = toast.loading("Consultando DUX…");
      try {
        const response = await probeDux(key);
        if (!response.ok) {
          toast.error(response.error.message, { id });
          return;
        }

        const result = response.data;
        console.group(`[DUX] ${result.label} · HTTP ${result.status ?? "sin respuesta"} · ${result.ms} ms`);
        console.log("GET", result.request);
        console.log(result.body);
        console.groupEnd();

        toast.dismiss(id);
        setResult(result);
      } catch (error) {
        console.error("[DUX] Prueba provisoria", error);
        toast.error("No se pudo consultar DUX", {
          id,
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-dashed" disabled={pending}>
            <FlaskConical />
            {pending ? "Consultando…" : "Probar DUX"}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Un request por consulta</DropdownMenuLabel>
          {OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.key}
              className="h-auto flex-col items-start gap-0.5 py-2"
              onSelect={() => run(option.key)}
            >
              <span className="font-medium">{option.label}</span>
              <span className="font-mono text-xs text-muted-foreground">{option.hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={result !== null} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent variant="side" className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Respuesta de DUX</DialogTitle>
            <DialogDescription>Prueba provisoria contra la API real. El token no sale del servidor.</DialogDescription>
          </DialogHeader>
          <DialogBody>{result && <ProbeResultView result={result} />}</DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Cuántos registros vinieron y cuántos hay en total (v2: datos + paginacion · v1: results + paging). */
function countRows(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const rows = Array.isArray(body) ? body : [record.datos, record.results].find(Array.isArray);
  if (!rows) return null;
  const paging = (record.paginacion ?? record.paging) as { total?: number; hay_mas?: boolean } | undefined;
  return { count: rows.length, total: paging?.total, hasMore: paging?.hay_mas };
}

const number = (value: number) => value.toLocaleString("es-AR");

function ProbeResultView({ result }: { result: DuxProbeResult }) {
  const json = typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2);
  const ok = result.status !== null && result.status >= 200 && result.status < 300;
  const rows = countRows(result.body);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("JSON copiado", { description: result.label });
    } catch {
      toast.error("No se pudo copiar", { description: "Seleccioná el texto y copialo a mano." });
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{result.label}</h3>
        <div className="flex items-center gap-2">
          <Badge variant={ok ? "success" : "danger"}>HTTP {result.status ?? "sin respuesta"}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">{result.ms} ms</span>
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy />
            Copiar JSON
          </Button>
        </div>
      </div>
      <p className="font-mono text-xs break-all text-muted-foreground">GET {result.request}</p>
      {rows && (
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{number(rows.count)}</span> registros en esta página
          {rows.total !== undefined && (
            <>
              {" · "}
              <span className="font-semibold tabular-nums">{number(rows.total)}</span> en total
            </>
          )}
          {rows.hasMore && " · hay más páginas"}
        </p>
      )}
      <pre className="max-h-[70dvh] overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-5">
        {json}
      </pre>
    </section>
  );
}
