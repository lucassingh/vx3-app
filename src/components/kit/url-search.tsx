"use client";

import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

type UrlSearchProps = {
  /** Nombre accesible ("Buscar pedidos"). */
  label: string;
  placeholder?: string;
  /** Parámetro de la URL donde vive el texto (default `q`). */
  param?: string;
  debounceMs?: number;
};

/**
 * Búsqueda sincronizada con la URL (?q=). El Server Component de la tabla
 * vuelve a pedir los datos a la API con el nuevo filtro y vuelve a la página 1.
 * Va dentro de <Suspense fallback={<SearchField disabled />}> (usa la URL).
 */
export function UrlSearch({ label, placeholder, param = "q", debounceMs = 300 }: UrlSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const pendingTimer = timer;
    return () => clearTimeout(pendingTimer.current);
  }, []);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const term = next.trim();
      if (term) params.set(param, term);
      else params.delete(param);
      params.delete("page");

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    }, debounceMs);
  };

  return (
    <SearchField value={value} onChange={onChange} pending={pending} aria-label={label} placeholder={placeholder} />
  );
}

/** Campo de búsqueda; también se usa como fallback mientras carga la URL. */
export function SearchField({
  pending = false,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { pending?: boolean }) {
  const Icon = pending ? LoaderCircle : Search;

  return (
    <div className={className ?? "relative w-full sm:w-64"}>
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground data-[pending=true]:animate-spin"
        data-pending={pending}
      />
      <Input type="search" aria-busy={pending} className="pl-9" placeholder="Buscar" {...props} />
    </div>
  );
}
