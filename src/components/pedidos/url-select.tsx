"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/ui/textarea";

type UrlSelectProps = {
  /** Parámetro de la URL ("canal"). */
  param: string;
  label: string;
  options: { value: string; label: string }[];
  /** Texto de la opción sin filtro ("Todos los canales"). */
  allLabel: string;
};

/** Filtro de un valor sincronizado con la URL. Va dentro de <Suspense> (usa la URL). */
export function UrlSelect({ param, label, options, allLabel }: UrlSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (event.target.value) params.set(param, event.target.value);
    else params.delete(param);
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <NativeSelect
      aria-label={label}
      aria-busy={pending}
      value={searchParams.get(param) ?? ""}
      onChange={onChange}
      className="w-full sm:w-48"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Fallback del filtro mientras se resuelve la URL. */
export function UrlSelectFallback({ allLabel, label }: { allLabel: string; label: string }) {
  return (
    <NativeSelect aria-label={label} disabled className="w-full sm:w-48">
      <option>{allLabel}</option>
    </NativeSelect>
  );
}
