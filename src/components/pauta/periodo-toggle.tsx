"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const OPCIONES = [
  { dias: 7, label: "7 días" },
  { dias: 14, label: "14 días" },
] as const;

/** Vista de 7 o 14 días (RF-M9-08). El período vive en la URL (?dias=14). */
export function PeriodoToggle() {
  return (
    <Suspense fallback={<Toggle active={7} pathname="" query="" />}>
      <LiveToggle />
    </Suspense>
  );
}

function LiveToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("dias") === "14" ? 14 : 7;
  return <Toggle active={active} pathname={pathname} query={searchParams.toString()} />;
}

function Toggle({ active, pathname, query }: { active: number; pathname: string; query: string }) {
  return (
    <nav
      aria-label="Período"
      className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
    >
      {OPCIONES.map(({ dias, label }) => {
        const params = new URLSearchParams(query);
        if (dias === 14) params.set("dias", "14");
        else params.delete("dias");
        const search = params.toString();
        const selected = active === dias;
        return (
          <Link
            key={dias}
            href={search ? `${pathname}?${search}` : pathname || "?"}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "inline-flex h-full items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground focus-visible:-outline-offset-2",
              selected && "bg-surface text-foreground shadow-card",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
