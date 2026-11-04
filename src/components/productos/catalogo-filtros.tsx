"use client";

import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SearchField, UrlSearch } from "@/components/kit/url-search";
import { NativeSelect } from "@/components/ui/textarea";
import type { CatalogoFacetas } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ESTADO_PRODUCTO } from "./labels";

type Filtro = { param: string; label: string; options: { value: string; label: string }[] };

function filtrosDe(facetas: CatalogoFacetas): Filtro[] {
  return [
    { param: "rubro", label: "Rubro", options: facetas.rubros.map((value) => ({ value, label: value })) },
    { param: "marca", label: "Marca", options: facetas.marcas.map((value) => ({ value, label: value })) },
    {
      param: "proveedor",
      label: "Proveedor",
      options: facetas.proveedores.map(({ id, nombre }) => ({ value: id, label: nombre })),
    },
    {
      param: "estado",
      label: "Estado",
      options: Object.entries(ESTADO_PRODUCTO).map(([value, { label }]) => ({ value, label })),
    },
    {
      param: "salud",
      label: "Salud",
      options: [
        { value: "completo", label: "Completos para el bot" },
        { value: "con_faltantes", label: "Con datos faltantes" },
      ],
    },
  ];
}

/** Filtros facetados del catálogo: viven en la URL para que la tabla los lea en el servidor. */
export function CatalogoFiltros({ facetas }: { facetas: CatalogoFacetas }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const vista = searchParams.get("vista") === "lista" ? "lista" : "grilla";

  const setParam = (param: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex w-full flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <UrlSearch label="Buscar productos" placeholder="SKU, nombre o marca" />
        <div
          role="group"
          aria-label="Vista"
          className="ml-auto inline-flex rounded-lg border border-border bg-muted p-0.5"
        >
          {(["grilla", "lista"] as const).map((value) => {
            const Icon = value === "grilla" ? LayoutGrid : List;
            const active = vista === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setParam("vista", value === "grilla" ? "" : value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:-outline-offset-2",
                  active && "bg-surface text-foreground shadow-card",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {value === "grilla" ? "Grilla" : "Lista"}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {filtrosDe(facetas).map((filtro) => (
          <NativeSelect
            key={filtro.param}
            aria-label={filtro.label}
            value={searchParams.get(filtro.param) ?? ""}
            onChange={(event) => setParam(filtro.param, event.target.value)}
          >
            <option value="">{filtro.label}: todos</option>
            {filtro.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        ))}
      </div>
    </div>
  );
}

/** Mismo lugar y forma mientras se resuelve la URL. */
export function CatalogoFiltrosFallback() {
  return (
    <div className="flex w-full flex-col gap-3">
      <SearchField disabled aria-label="Buscar productos" placeholder="SKU, nombre o marca" />
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {["Rubro", "Marca", "Proveedor", "Estado", "Salud"].map((label) => (
          <NativeSelect key={label} aria-label={label} disabled>
            <option>{label}: todos</option>
          </NativeSelect>
        ))}
      </div>
    </div>
  );
}
