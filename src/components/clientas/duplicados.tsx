import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/kit/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";

function DuplicadosFrame({ count, children }: { count?: number; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>
            Fichas unificadas
            {count !== undefined && count > 0 && (
              <span className="ml-2 text-[13px] font-normal text-muted-foreground tabular-nums">{count}</span>
            )}
          </CardTitle>
          <CardDescription>
            Las fichas de DUX con el mismo teléfono son una clienta: se unen solas y suman sus compras (RN-90). Esto es
            para revisarlas.
          </CardDescription>
        </div>
      </CardHeader>
      <div className="border-t border-border">{children}</div>
    </Card>
  );
}

export async function DuplicadosCard() {
  const duplicados = await api.clientas.duplicados();
  return (
    <DuplicadosFrame count={duplicados.length}>
      {duplicados.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="No hay fichas unificadas"
          description="Cada clienta tiene una sola ficha en DUX. Si aparece un teléfono repetido, lo vas a ver acá."
        />
      ) : (
        <div role="region" aria-label="Fichas unificadas" tabIndex={0} className="max-h-112 overflow-y-auto">
          <ul className="divide-y divide-border">
            {duplicados.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-medium">{item.nombre}</p>
                    <span className="font-mono text-xs text-muted-foreground">{item.telefonoNormalizado}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{item.motivo}</p>
                  <ul className="flex flex-wrap gap-2">
                    {item.registros.map((registro, index) => (
                      <li
                        key={`${registro.sistema}-${index}`}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                      >
                        <Badge variant="outline">{registro.sistema}</Badge>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{registro.nombre}</span>
                          <span className="block truncate text-muted-foreground">{registro.detalle}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" size="sm" className="self-start sm:self-center" asChild>
                  <Link href={`/clientas/fichas?clienta=${item.clientaId}`} scroll={false}>
                    Ver ficha<span className="sr-only"> de {item.nombre}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DuplicadosFrame>
  );
}

export function DuplicadosCardSkeleton() {
  return (
    <DuplicadosFrame>
      <LoadingLabel>Cargando fichas unificadas…</LoadingLabel>
      <div className="p-5">
        <SkeletonText lines={5} />
      </div>
    </DuplicadosFrame>
  );
}
