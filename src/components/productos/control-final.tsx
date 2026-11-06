import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/server";
import { formatNumber } from "@/lib/format";

/** Son muchos cuando algo se rompe: con los primeros alcanza para ver el patrón. */
const FALLAS_A_LA_VISTA = 25;

/** RF-M1-09: corre solo, con lo que ya se leyó de DUX y de la tienda. Marca, no corrige. */
export async function ControlFinal() {
  const chequeos = await api.catalogo.control();
  const conFallas = chequeos.filter(({ fallas }) => fallas.length > 0).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Control final</CardTitle>
          <CardDescription>
            {conFallas === 0
              ? "Todo en regla, con lo último que se leyó de DUX y de la tienda"
              : `${conFallas === 1 ? "1 chequeo marca" : `${conFallas} chequeos marcan`} algo, con lo último que se leyó de DUX y de la tienda`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="divide-y divide-border">
          {chequeos.map(({ id, label, regla, revisados, fallas, aviso }) => (
            <li key={id} className="py-2.5">
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2.5 text-sm">
                  {aviso ? (
                    <CircleDashed aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  ) : fallas.length > 0 ? (
                    <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
                  ) : (
                    <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
                  )}
                  <span className="min-w-0 flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{regla}</span>
                  <Badge variant={aviso ? "neutral" : fallas.length > 0 ? "danger" : "success"}>
                    {aviso
                      ? "Sin leer"
                      : fallas.length > 0
                        ? `${formatNumber(fallas.length)} de ${formatNumber(revisados)}`
                        : `${formatNumber(revisados)} bien`}
                  </Badge>
                </summary>
                <div className="space-y-2 pt-2.5 pl-6.5">
                  {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
                  {fallas.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {fallas.slice(0, FALLAS_A_LA_VISTA).map(({ sku, nombre, detalle }) => (
                        <li key={`${sku}-${detalle}`} className="flex flex-wrap gap-x-2">
                          <Link
                            href={`/productos/catalogo?producto=${encodeURIComponent(sku)}`}
                            className="font-mono underline-offset-2 hover:underline"
                          >
                            {sku}
                          </Link>
                          <span className="text-muted-foreground">{detalle}</span>
                          <span className="sr-only">{nombre}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {fallas.length > FALLAS_A_LA_VISTA && (
                    <p className="text-xs text-muted-foreground">
                      Y {formatNumber(fallas.length - FALLAS_A_LA_VISTA)} más.
                    </p>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ControlFinalSkeleton() {
  return (
    <Card>
      <CardHeader>
        <LoadingLabel>Cargando el control final…</LoadingLabel>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton key={indice} className="h-5 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
