"use client";

import { Download, LoaderCircle, PackageX, TriangleAlert, WandSparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { CatalogoCombo, CatalogoCombosModo, CatalogoCombosResultado } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { porcentaje } from "./porcentaje";

const MODOS: { id: CatalogoCombosModo; label: string; description: string }[] = [
  { id: "margen", label: "Margen y rotación", description: "Lo que más deja y más se mueve" },
  { id: "liquidar_stock", label: "Liquidar stock alto", description: "Los que tienen más días de stock" },
  { id: "liquidar_categoria", label: "Liquidar una categoría", description: "Prioriza el rubro que elijas" },
];

const TEMAS = {
  ocre: { label: "Ocre", className: "bg-secondary text-secondary-foreground" },
  negro: { label: "Negro", className: "bg-accent text-accent-foreground" },
  claro: { label: "Claro", className: "border border-border bg-surface text-foreground" },
} as const;

type Tema = keyof typeof TEMAS;

/** Flyer a escala con las proporciones reales: feed 1080 × 1350 (4:5) e historia 1080 × 1920 (9:16). */
function Flyer({ combo, formato, tema }: { combo: CatalogoCombo; formato: "feed" | "historia"; tema: Tema }) {
  const porPrenda = combo.total / combo.prendas;
  return (
    <figure className="space-y-2">
      <div
        role="img"
        aria-label={`Flyer ${formato === "feed" ? "para feed" : "para historia"} de ${combo.nombre}: ${formatCurrency(combo.total)}`}
        className={cn(
          "@container relative flex flex-col overflow-hidden rounded-lg shadow-card",
          formato === "feed" ? "aspect-[4/5] w-full" : "aspect-[9/16] w-full",
          TEMAS[tema].className,
        )}
      >
        <div aria-hidden className="flex h-full flex-col p-[6cqw]">
          <p className="text-[3.6cqw] font-semibold uppercase tracking-[0.2em] opacity-80">VX3 · Ventas por Tres</p>
          <p className="mt-[2cqw] text-[9cqw] font-semibold uppercase leading-none tracking-tight">{combo.nombre}</p>
          <p className="mt-[2cqw] text-[3.8cqw] opacity-80">
            {combo.bultos} bultos · {combo.prendas} prendas
          </p>
          <div className={cn("mt-[4cqw] grid gap-[2cqw]", formato === "feed" ? "grid-cols-3" : "grid-cols-2")}>
            {combo.items.map((item) => (
              <ProductThumb key={item.codigo} sku={item.sku} colors={item.colores} size="lg" className="rounded-[2cqw] border-0 text-[2.6cqw]" />
            ))}
          </div>
          <div className="mt-auto pt-[4cqw]">
            <p className="text-[3.6cqw] uppercase tracking-wide opacity-80">Precio del pack</p>
            <p className="text-[12cqw] font-semibold leading-none tracking-tight tabular-nums">{formatCurrency(combo.total)}</p>
            <p className="mt-[1.5cqw] text-[4cqw] tabular-nums">{formatCurrency(porPrenda)} por prenda</p>
            <p className="mt-[3cqw] text-[3.2cqw] opacity-75">Precio mayorista · colores sujetos a stock · pedilo por WhatsApp</p>
          </div>
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {formato === "feed" ? "Feed · 1080 × 1350" : "Historia · 1080 × 1920"}
      </figcaption>
    </figure>
  );
}

export function CombosGenerador({
  rubros,
  inicial,
}: {
  rubros: string[];
  inicial: CatalogoCombosResultado;
}) {
  const [modo, setModo] = useState<CatalogoCombosModo>("margen");
  const [categoria, setCategoria] = useState(rubros.includes("Invierno") ? "Invierno" : (rubros[0] ?? ""));
  const [forzar, setForzar] = useState("");
  const [resultado, setResultado] = useState(inicial);
  const [seleccion, setSeleccion] = useState(inicial.combos[0]?.id ?? "");
  const [tema, setTema] = useState<Tema>("ocre");
  const [pending, startTransition] = useTransition();

  const combo = resultado.combos.find((item) => item.id === seleccion) ?? resultado.combos[0];

  const generar = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const nuevo = await api.catalogo.combos({
          modo,
          categoria: modo === "liquidar_categoria" ? categoria : undefined,
          forzar: forzar.trim() || undefined,
        });
        setResultado(nuevo);
        setSeleccion(nuevo.combos[0]?.id ?? "");
        toast.success(
          nuevo.combos.length === 1 ? "Se armó 1 combo" : `Se armaron ${nuevo.combos.length} combos`,
          { description: "Con el costo vigente del stock, no el que congeló DUX en la venta." },
        );
      } catch {
        toast.error("No se pudieron generar los combos", { description: "Probá de nuevo en un momento." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Generador</CardTitle>
            <CardDescription>
              Entre $ 45.000 y $ 60.000, de 4 a 6 bultos, con cada SKU como máximo 5 veces por tanda (RN-108)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={generar} className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Modo</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODOS.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                      modo === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="radio"
                      name="modo"
                      value={item.id}
                      checked={modo === item.id}
                      onChange={() => setModo(item.id)}
                      className="mt-0.5 accent-(--primary)"
                    />
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="combos-categoria">Categoría a liquidar</Label>
                <NativeSelect
                  id="combos-categoria"
                  value={categoria}
                  onChange={(event) => setCategoria(event.target.value)}
                  disabled={modo !== "liquidar_categoria"}
                >
                  {rubros.map((rubro) => (
                    <option key={rubro} value={rubro}>
                      {rubro}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="combos-forzar">SKUs que tienen que estar</Label>
                <Input
                  id="combos-forzar"
                  value={forzar}
                  onChange={(event) => setForzar(event.target.value.toUpperCase())}
                  placeholder="Ej. CJATN14, LN35"
                  className="font-mono uppercase"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <WandSparkles />}
                {pending ? "Armando…" : "Generar combos"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section aria-labelledby="combos-titulo" className="min-w-0 space-y-3">
          <h2 id="combos-titulo" className="text-[15px] font-semibold tracking-tight">
            Combos sugeridos <span className="font-normal text-muted-foreground">· {resultado.combos.length}</span>
          </h2>
          {resultado.combos.length === 0 ? (
            <Card>
              <EmptyState
                icon={PackageX}
                title="No entró ningún combo en el rango"
                description="Probá con otro modo o sacá alguno de los SKUs forzados."
              />
            </Card>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2" aria-busy={pending}>
              {resultado.combos.map((item) => {
                const activo = combo?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setSeleccion(item.id)}
                      className={cn(
                        "flex h-full w-full flex-col gap-3 rounded-xl border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow,scale] duration-150 ease-snappy active:scale-[0.99]",
                        activo ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-semibold">{item.nombre}</span>
                          <span className="block text-xs text-muted-foreground">
                            {item.bultos} bultos · {item.prendas} prendas
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-lg font-semibold leading-6 tabular-nums">{formatCurrency(item.total)}</span>
                          <Badge variant={item.avisoMargen ? "warning" : "success"} dot>
                            Margen {porcentaje(item.margen, 0)}
                          </Badge>
                        </span>
                      </span>
                      <ul className="space-y-1.5 border-t border-border pt-3">
                        {item.items.map((linea) => (
                          <li key={linea.codigo} className="flex items-center gap-2.5 text-[13px]">
                            <ProductThumb sku="" colors={linea.colores} size="sm" className="size-6 rounded-md" />
                            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{linea.codigo}</span>
                            <span className="min-w-0 flex-1 truncate">{linea.nombre}</span>
                            <span className="shrink-0 tabular-nums">{formatCurrency(linea.precio)}</span>
                          </li>
                        ))}
                      </ul>
                      {item.avisoMargen && (
                        <span className="flex items-center gap-1.5 text-xs text-warning">
                          <TriangleAlert aria-hidden className="size-3.5" />
                          Margen bajo el 10 %: revisalo antes de publicarlo
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {combo && (
          <Card className="self-start xl:sticky xl:top-20">
            <CardHeader>
              <div>
                <CardTitle>Flyers de {combo.nombre}</CardTitle>
                <CardDescription>Con las fotos del catálogo, el precio del pack y el precio por prenda</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div role="group" aria-label="Color del flyer" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
                {(Object.keys(TEMAS) as Tema[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tema === key}
                    onClick={() => setTema(key)}
                    className={cn(
                      "h-8 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:-outline-offset-2",
                      tema === key && "bg-surface text-foreground shadow-card",
                    )}
                  >
                    {TEMAS[key].label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[3fr_2fr] items-start gap-3">
                <Flyer combo={combo} formato="feed" tema={tema} />
                <Flyer combo={combo} formato="historia" tema={tema} />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  toast.success("Flyers listos", {
                    description: `${combo.nombre}: feed 1080 × 1350 e historia 1080 × 1920, en ${TEMAS[tema].label.toLowerCase()}.`,
                  })
                }
              >
                <Download />
                Descargar los dos
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Quiebres de stock</CardTitle>
              <CardDescription>Se venden más rápido de lo que hay: no conviene meterlos en un combo</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {resultado.quiebres.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No hay productos en quiebre.</p>
            ) : (
              <ul className="divide-y divide-border">
                {resultado.quiebres.map((item) => (
                  <li key={item.sku} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{item.sku}</span>
                    <span className="min-w-0 flex-1 truncate">{item.nombre}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <span className="font-medium text-warning">{formatNumber(item.bultos)} bultos</span> · vende{" "}
                      {formatNumber(item.rotacionSemanal)} por semana
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Costos sospechosos</CardTitle>
              <CardDescription>DUX congela el costo en la venta y puede mostrar un margen falso (RN-109)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="divide-y divide-border">
              {resultado.sospechosos.map((item) => (
                <li key={item.sku} className="space-y-1 py-2.5 text-sm">
                  <p className="flex items-center gap-3">
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{item.sku}</span>
                    <span className="min-w-0 flex-1 truncate">{item.nombre}</span>
                    <span className="shrink-0 text-xs tabular-nums">
                      <span className="text-danger line-through">{porcentaje(item.margenAparente, 0)}</span>{" "}
                      → <span className="font-medium">{porcentaje(item.margenReal, 0)}</span>
                    </span>
                  </p>
                  <p className="pl-19 text-xs text-muted-foreground">{item.motivo}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
