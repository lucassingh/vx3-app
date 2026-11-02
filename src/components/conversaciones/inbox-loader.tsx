import { Card } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/server";
import { cn } from "@/lib/utils";
import { Inbox } from "./inbox";
import { toConversacionView } from "./view";

/** Pide la bandeja y arma la vista en el servidor (fechas y montos ya formateados). */
export async function InboxLoader() {
  const bandeja = await api.conversaciones.bandeja();
  const now = new Date(bandeja.generadoEn).getTime();

  return (
    <Inbox
      initial={bandeja.conversaciones.map((conversacion) => toConversacionView(conversacion, now))}
      respuestasRapidas={bandeja.respuestasRapidas}
      plantillas={bandeja.plantillas}
      motivosToma={bandeja.motivosToma}
    />
  );
}

const bubbles = [
  { side: "start", width: "w-56" },
  { side: "end", width: "w-72" },
  { side: "end", width: "w-48" },
  { side: "start", width: "w-40" },
  { side: "end", width: "w-64" },
] as const;

export function InboxSkeleton() {
  return (
    <Card className="grid h-[min(54rem,calc(100dvh-7.5rem))] min-h-[34rem] overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
      <LoadingLabel>Cargando conversaciones…</LoadingLabel>
      <div className="flex min-h-0 flex-col border-border lg:border-r">
        <div className="space-y-3 border-b border-border p-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="flex gap-1.5">
            {[14, 20, 16, 12].map((width, index) => (
              <Skeleton key={index} className="h-7 rounded-full" style={{ width: `${width * 4}px` }} />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex gap-3 px-4 py-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden min-h-0 flex-col lg:flex">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex-1 space-y-4 bg-canvas/60 px-5 py-6">
          {bubbles.map((bubble, index) => (
            <div key={index} className={cn("flex", bubble.side === "end" ? "justify-end" : "justify-start")}>
              <Skeleton className={cn("h-14 rounded-2xl", bubble.width)} />
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
      <div className="hidden space-y-4 border-l border-border p-5 xl:block">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
