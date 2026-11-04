"use client";

import { ArrowRight, History } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditoriaCategoria } from "@/lib/api/types";

/** Fila del registro con la fecha ya formateada en el servidor. */
export type AuditoriaRow = {
  id: string;
  usuario: string;
  categoria: AuditoriaCategoria;
  accion: string;
  antes?: string;
  despues?: string;
  en: string;
  cuando: string;
};

export const CATEGORIA: Record<
  AuditoriaCategoria,
  { label: string; variant: "success" | "primary" | "accent" | "warning" | "neutral" }
> = {
  plata: { label: "Plata", variant: "success" },
  precios: { label: "Precios", variant: "primary" },
  stock: { label: "Stock", variant: "accent" },
  reglas: { label: "Reglas", variant: "warning" },
  accesos: { label: "Accesos", variant: "neutral" },
};

const FILTROS: ("todo" | AuditoriaCategoria)[] = ["todo", "plata", "precios", "stock", "reglas", "accesos"];

/** Registro de auditoría: quién, cuándo, qué, y el antes y el después. */
export function AuditoriaList({ rows, filtros = true }: { rows: AuditoriaRow[]; filtros?: boolean }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todo");
  const visibles = filtro === "todo" ? rows : rows.filter((row) => row.categoria === filtro);

  return (
    <div className="space-y-4">
      {filtros && (
        <Tabs value={filtro} onValueChange={(value) => setFiltro(value as typeof filtro)}>
          <TabsList aria-label="Filtrar el registro">
            {FILTROS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {value === "todo" ? "Todo" : CATEGORIA[value].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {visibles.length === 0 ? (
        <EmptyState icon={History} title="No hay movimientos de este tipo" />
      ) : (
        <ol className="divide-y divide-border">
          {visibles.map((row) => (
            <li key={row.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
              <Avatar name={row.usuario} className="mt-0.5 size-7" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm text-pretty">{row.accion}</p>
                {(row.antes || row.despues) && (
                  <p className="flex flex-wrap items-center gap-2 text-[13px] tabular-nums">
                    {row.antes && (
                      <>
                        <span className="text-muted-foreground">
                          <span className="sr-only">Antes: </span>
                          {row.antes}
                        </span>
                        <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                      </>
                    )}
                    {row.despues && (
                      <span className="font-medium">
                        <span className="sr-only">{row.antes ? "Después: " : "Valor: "}</span>
                        {row.despues}
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {row.usuario} · <time dateTime={row.en}>{row.cuando}</time>
                </p>
              </div>
              <Badge variant={CATEGORIA[row.categoria].variant} className="mt-0.5 self-start">
                {CATEGORIA[row.categoria].label}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
