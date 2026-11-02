"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SearchField, UrlSearch } from "@/components/kit/url-search";
import { NativeSelect } from "@/components/ui/textarea";
import { ESTADO_STOCK } from "./labels";

/** Búsqueda, rubro y estado del espejo de stock, en la URL. */
export function StockFiltros({ rubros }: { rubros: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (param: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto" aria-busy={pending}>
      <UrlSearch label="Buscar en el stock" placeholder="SKU o producto" />
      <NativeSelect
        aria-label="Rubro"
        value={searchParams.get("rubro") ?? ""}
        onChange={(event) => setParam("rubro", event.target.value)}
        className="w-full sm:w-44"
      >
        <option value="">Todos los rubros</option>
        {rubros.map((rubro) => (
          <option key={rubro} value={rubro}>
            {rubro}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Estado"
        value={searchParams.get("estado") ?? ""}
        onChange={(event) => setParam("estado", event.target.value)}
        className="w-full sm:w-44"
      >
        <option value="">Todos los estados</option>
        {Object.entries(ESTADO_STOCK).map(([value, { label }]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function StockFiltrosFallback() {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <SearchField disabled aria-label="Buscar en el stock" placeholder="SKU o producto" />
      <NativeSelect aria-label="Rubro" disabled className="w-full sm:w-44">
        <option>Todos los rubros</option>
      </NativeSelect>
      <NativeSelect aria-label="Estado" disabled className="w-full sm:w-44">
        <option>Todos los estados</option>
      </NativeSelect>
    </div>
  );
}
