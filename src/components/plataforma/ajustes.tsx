import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingLabel } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/views/skeletons";
import { api } from "@/lib/api/server";
import { AlertasForm } from "./alertas-form";

function AlertasFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Alertas</CardTitle>
          <CardDescription>Qué te avisa la app y por dónde. Siempre quedan también en la campana.</CardDescription>
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export async function AlertasCard() {
  const preferencias = await api.plataforma.preferencias.get();
  return (
    <AlertasFrame>
      <AlertasForm initial={preferencias} />
    </AlertasFrame>
  );
}

export function AlertasSkeleton() {
  return (
    <AlertasFrame>
      <LoadingLabel>Cargando alertas…</LoadingLabel>
      <TableSkeleton columns={["Alerta", "En la app", "WhatsApp", "Mail"]} rows={6} className="min-w-xl" />
    </AlertasFrame>
  );
}
