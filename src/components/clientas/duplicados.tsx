import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { SkeletonText } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { DuplicadosList } from "./duplicados-list";

function DuplicadosFrame({ count, children }: { count?: number; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>
            Duplicados para fusionar
            {count !== undefined && count > 0 && (
              <span className="ml-2 text-[13px] font-normal text-muted-foreground tabular-nums">{count}</span>
            )}
          </CardTitle>
          <CardDescription>
            El mismo teléfono en DUX, Tienda Nube o el local con otro nombre (RN-90 y RN-91)
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
      <DuplicadosList initialItems={duplicados} />
    </DuplicadosFrame>
  );
}

export function DuplicadosCardSkeleton() {
  return (
    <DuplicadosFrame>
      <LoadingLabel>Cargando duplicados…</LoadingLabel>
      <div className="p-5">
        <SkeletonText lines={5} />
      </div>
    </DuplicadosFrame>
  );
}
