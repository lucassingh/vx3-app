import {
  Bot,
  CircleCheck,
  Link2,
  Megaphone,
  MessageSquareWarning,
  Mic,
  PackageCheck,
  ReceiptText,
  Repeat2,
  Store,
  StickyNote,
  Truck,
  UserCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { ProductThumb } from "@/components/kit/product-thumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MensajeView } from "./view";

type Sistema = Extract<MensajeView, { tipo: "sistema" }>;

const eventoIcon: Record<Sistema["evento"], LucideIcon> = {
  anuncio: Megaphone,
  envio: Truck,
  pedido: PackageCheck,
  derivacion: MessageSquareWarning,
  seguimiento: Repeat2,
  toma: UserCheck,
  vidriera: Store,
  reclamo: MessageSquareWarning,
  cierre: CircleCheck,
};

function Time({ iso, label, className }: { iso: string; label: string; className?: string }) {
  return (
    <time dateTime={iso} className={cn("mt-1 block text-right text-[11px] tabular-nums", className)}>
      {label}
    </time>
  );
}

/** Lado y estilo de la burbuja según quién escribe. */
function Bubble({
  side,
  tone,
  author,
  children,
}: {
  side: "in" | "out";
  tone: "clienta" | "bot" | "persona";
  author?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex", side === "in" ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[75%]",
          tone === "clienta" && "rounded-bl-md border border-border bg-surface shadow-card",
          tone === "bot" && "rounded-br-md bg-primary/10",
          tone === "persona" && "rounded-br-md bg-primary text-primary-foreground",
        )}
      >
        {author && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium">{author}</p>}
        {children}
      </div>
    </div>
  );
}

const botAuthor = (
  <span className="flex items-center gap-1 text-muted-foreground">
    <Bot aria-hidden className="size-3" />
    Asistente VX3
  </span>
);

export function MessageItem({ mensaje }: { mensaje: MensajeView }) {
  switch (mensaje.tipo) {
    case "sistema": {
      const Icon = eventoIcon[mensaje.evento];
      return (
        <p className="mx-auto flex w-fit max-w-[92%] items-start gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
          <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            {mensaje.texto}
            <span className="sr-only"> · {mensaje.hora}</span>
          </span>
        </p>
      );
    }

    case "nota":
      return (
        <div className="rounded-xl border border-dashed border-warning/45 bg-warning/8 px-3.5 py-2.5 text-sm">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <StickyNote aria-hidden className="size-3.5" />
            Nota interna de {mensaje.autorNombre} · solo la ve el equipo
          </p>
          <p className="leading-relaxed">{mensaje.texto}</p>
          <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
        </div>
      );

    case "texto": {
      if (mensaje.autor === "clienta") {
        return (
          <Bubble side="in" tone="clienta">
            <p className="whitespace-pre-line">{mensaje.texto}</p>
            <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
          </Bubble>
        );
      }
      if (mensaje.autor === "bot") {
        return (
          <Bubble side="out" tone="bot" author={botAuthor}>
            <p className="whitespace-pre-line">{mensaje.texto}</p>
            <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
          </Bubble>
        );
      }
      return (
        <Bubble
          side="out"
          tone="persona"
          author={
            <span>
              {mensaje.autorNombre}
              {mensaje.plantilla && ` · plantilla ${mensaje.plantilla}`}
            </span>
          }
        >
          <p className="whitespace-pre-line">{mensaje.texto}</p>
          <Time iso={mensaje.enviadoEn} label={mensaje.hora} />
        </Bubble>
      );
    }

    case "producto":
      return (
        <Bubble
          side="out"
          tone={mensaje.autor === "bot" ? "bot" : "persona"}
          author={mensaje.autor === "bot" ? botAuthor : undefined}
        >
          <div className="flex gap-3 rounded-xl border border-border bg-surface p-2.5 text-foreground">
            <ProductThumb sku={mensaje.sku} colors={mensaje.colores} size="md" />
            <div className="min-w-0 space-y-0.5">
              <p className="line-clamp-2 text-[13px] leading-snug font-medium">{mensaje.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {mensaje.presentacion} ·{" "}
                <span className="font-semibold text-foreground tabular-nums">{mensaje.montos?.precio}</span>
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className={cn("size-1.5 rounded-full", mensaje.stockBultos > 3 ? "bg-success" : "bg-warning")}
                  aria-hidden
                />
                {mensaje.stockBultos} {mensaje.stockBultos === 1 ? "bulto disponible" : "bultos disponibles"}
              </p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Link2 aria-hidden className="size-3 shrink-0" />
                {mensaje.link}
              </p>
            </div>
          </div>
          <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
        </Bubble>
      );

    case "comprobante": {
      const coincide = !mensaje.montos?.diferencia;
      return (
        <Bubble side="in" tone="clienta">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ReceiptText aria-hidden className="size-3.5" />
            Comprobante · leído con IA
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-muted-foreground">Monto</dt>
            <dd className="font-semibold tabular-nums">{mensaje.montos?.monto}</dd>
            <dt className="text-muted-foreground">Banco</dt>
            <dd>{mensaje.banco}</dd>
            <dt className="text-muted-foreground">Titular</dt>
            <dd>{mensaje.titular}</dd>
            <dt className="text-muted-foreground">Operación</dt>
            <dd className="font-mono text-xs leading-5">{mensaje.operacion}</dd>
          </dl>
          <div className="mt-2.5">
            {coincide ? (
              <Badge variant="success" dot>
                Coincide con {mensaje.pedidoId}
              </Badge>
            ) : (
              <Badge variant="danger" dot>
                No coincide con {mensaje.pedidoId}: {mensaje.montos?.diferencia} de diferencia
              </Badge>
            )}
          </div>
          <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
        </Bubble>
      );
    }

    case "audio":
      return (
        <Bubble side="in" tone="clienta">
          <p className="flex items-center gap-2 text-[13px]">
            <span className="grid size-7 place-items-center rounded-full bg-primary/12 text-primary">
              <Mic aria-hidden className="size-3.5" />
            </span>
            <span aria-hidden className="flex h-5 items-center gap-0.5">
              {[3, 7, 4, 9, 6, 11, 5, 8, 4, 10, 6, 3, 7, 5].map((height, index) => (
                <span
                  key={index}
                  className="w-0.5 rounded-full bg-muted-foreground/60"
                  style={{ height: `${height * 1.6}px` }}
                />
              ))}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">Audio · {mensaje.duracion}</span>
          </p>
          <p className="mt-2 border-t border-border pt-2 text-[13px] leading-relaxed">
            <span className="text-xs font-medium text-muted-foreground">Transcripción: </span>
            {mensaje.transcripcion}
          </p>
          <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
        </Bubble>
      );

    case "adjunto":
      return (
        <Bubble side="in" tone="clienta">
          <p className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Video aria-hidden className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{mensaje.titulo}</span>
              <span className="block text-xs text-muted-foreground">{mensaje.detalle}</span>
            </span>
          </p>
          <Time iso={mensaje.enviadoEn} label={mensaje.hora} className="text-muted-foreground" />
        </Bubble>
      );
  }
}
