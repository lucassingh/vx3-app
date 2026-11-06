"use client";

import { LayoutGrid, List, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SearchField, UrlSearch } from "@/components/kit/url-search";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/textarea";
import type { CatalogoFacetas } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VIGENCIA } from "./labels";

/** Sin elegir nada, los históricos no aparecen: el texto lo tiene que decir, y entrar en el selector. */
const TODOS_LOS_ESTADOS = "Activos y agotados";

type Filtro = { param: string; label: string; todos: string; options: { value: string; label: string }[] };

const opciones = (facetas: CatalogoFacetas[keyof CatalogoFacetas]) =>
  facetas.map(({ valor, etiqueta, productos }) => ({
    value: valor,
    label: `${etiqueta} (${formatNumber(productos)})`,
  }));

function filtrosDe(facetas: CatalogoFacetas): Filtro[] {
  const con = (param: string, label: string, lista: Filtro["options"]): Filtro => ({
    param,
    label,
    todos: `${label}: todos`,
    options: lista,
  });
  return [
    con("rubro", "Rubro", opciones(facetas.rubros)),
    con("subrubro", "Subrubro", opciones(facetas.subrubros)),
    con("marca", "Marca", opciones(facetas.marcas)),
    con("tela", "Tela", opciones(facetas.telas)),
    con("talle", "Talle", opciones(facetas.talles)),
    con("color", "Color", opciones(facetas.colores)),
    con("proveedor", "Último proveedor", opciones(facetas.proveedores)),
    {
      param: "estado",
      label: "Estado",
      todos: TODOS_LOS_ESTADOS,
      options: Object.entries(VIGENCIA).map(([value, { plural }]) => ({ value, label: plural })),
    },
    {
      param: "salud",
      label: "Para vender",
      todos: "Para vender: todos",
      options: [
        { value: "listo", label: "Listos para vender" },
        { value: "no_listo", label: "Les falta algo" },
      ],
    },
  ];
}

const PARAMETROS_DE_FILTRO = ["rubro", "subrubro", "marca", "tela", "talle", "color", "proveedor", "estado", "salud"];

const GRILLA_DE_FILTROS = "grid gap-2 sm:grid-cols-3 lg:grid-cols-5";

/** Filtros facetados del catálogo: viven en la URL para que la lista los lea en el servidor. */
export function CatalogoFiltros({ facetas }: { facetas: CatalogoFacetas }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const vista = searchParams.get("vista") === "lista" ? "lista" : "grilla";
  const hayFiltros = PARAMETROS_DE_FILTRO.some((param) => searchParams.has(param));

  const ir = (params: URLSearchParams) => {
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const setParam = (param: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    // La página cambia con el filtro, y un subrubro es de un solo rubro.
    if (param !== "vista") params.delete("page");
    if (param === "rubro") params.delete("subrubro");
    ir(params);
  };

  const limpiar = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const param of [...PARAMETROS_DE_FILTRO, "page"]) params.delete(param);
    ir(params);
  };

  return (
    <div className="flex w-full flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <UrlSearch label="Buscar productos" placeholder="Código, nombre o marca" />
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
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors",
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
      <div className={GRILLA_DE_FILTROS}>
        {filtrosDe(facetas).map((filtro) => (
          <NativeSelect
            key={filtro.param}
            aria-label={filtro.label}
            value={searchParams.get(filtro.param) ?? ""}
            onChange={(event) => setParam(filtro.param, event.target.value)}
          >
            <option value="">{filtro.todos}</option>
            {filtro.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        ))}
        {hayFiltros && (
          <Button variant="ghost" onClick={limpiar} className="justify-start">
            <X />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

const ETIQUETAS_DEL_FALLBACK = [
  "Rubro",
  "Subrubro",
  "Marca",
  "Tela",
  "Talle",
  "Color",
  "Último proveedor",
  "Estado",
  "Para vender",
];

/** Mismo lugar y forma mientras se resuelve la URL. */
export function CatalogoFiltrosFallback() {
  return (
    <div className="flex w-full flex-col gap-3">
      <SearchField disabled aria-label="Buscar productos" placeholder="Código, nombre o marca" />
      <div className={GRILLA_DE_FILTROS}>
        {ETIQUETAS_DEL_FALLBACK.map((label) => (
          <NativeSelect key={label} aria-label={label} disabled>
            <option>{label === "Estado" ? TODOS_LOS_ESTADOS : `${label}: todos`}</option>
          </NativeSelect>
        ))}
      </div>
    </div>
  );
}
