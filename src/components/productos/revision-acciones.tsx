"use client";

import { Archive, Check, LoaderCircle, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { Result } from "@/lib/result";
import { toast } from "@/lib/toast";
import {
  confirmarHistoricos,
  decidirFotoSuelta,
  deshacerDecisionDelCatalogo,
  noEsHistorico,
} from "@/modules/catalog/actions";

const CON_IMPORTACION = { description: "Hay una importación en curso: se aplica cuando termine." };

function useDecision() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const decidir = (accion: () => Promise<Result<{ aplicada: boolean }>>, aviso: string, alTerminar?: () => void) => {
    startTransition(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error.message });
        return;
      }
      toast.success(aviso, resultado.data.aplicada ? undefined : CON_IMPORTACION);
      alTerminar?.();
      router.refresh();
    });
  };

  return { pending, decidir };
}

/** A qué producto va una foto suelta: una sugerencia, otro código, o descartarla. */
export function DecidirFoto({
  driveId,
  nombre,
  sugerencias,
}: {
  driveId: string;
  nombre: string;
  sugerencias: string[];
}) {
  const { pending, decidir } = useDecision();
  const [codigo, setCodigo] = useState("");

  const asignar = (producto: string) =>
    decidir(() => decidirFotoSuelta({ driveId, producto }), `${nombre} va en ${producto.toUpperCase()}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sugerencias.map((sugerencia) => (
        <Button key={sugerencia} variant="outline" size="sm" disabled={pending} onClick={() => asignar(sugerencia)}>
          <Check />
          Es de <span className="font-mono">{sugerencia}</span>
        </Button>
      ))}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (codigo.trim()) asignar(codigo.trim());
        }}
      >
        <Input
          aria-label={`Código del producto de ${nombre}`}
          placeholder="Otro código"
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
          className="h-8 w-32 font-mono text-[13px]"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending || !codigo.trim()}>
          Asignar
        </Button>
      </form>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => decidir(() => decidirFotoSuelta({ driveId, producto: null }), `${nombre} quedó descartada`)}
      >
        {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Trash2 />}
        Descartar
      </Button>
    </div>
  );
}

/** Una excepción antes de confirmar en bloque. */
export function NoEsHistorico({ sku }: { sku: string }) {
  const { pending, decidir } = useDecision();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => decidir(() => noEsHistorico({ producto: sku }), `${sku} no es histórico: queda como agotado`)}
    >
      {pending && <LoaderCircle aria-hidden className="animate-spin" />}
      No es histórico<span className="sr-only">: {sku}</span>
    </Button>
  );
}

export function ConfirmarHistoricos({ cantidad }: { cantidad: number }) {
  const { pending, decidir } = useDecision();
  const [abierto, setAbierto] = useState(false);
  const total = formatNumber(cantidad);

  return (
    <>
      <Button onClick={() => setAbierto(true)}>
        <Archive />
        Confirmar {cantidad === 1 ? "el histórico" : `los ${total}`}
      </Button>
      <Dialog open={abierto} onOpenChange={(siguiente) => !pending && setAbierto(siguiente)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar {cantidad === 1 ? "1 histórico" : `${total} históricos`}</DialogTitle>
            <DialogDescription>Salen de esta lista, y se siguen pudiendo buscar en el catálogo.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-pretty text-muted-foreground">
              Nunca se borran: si alguno vuelve a tener stock, vuelve solo como activo y con su mismo código. Lo que no
              sea histórico, sacalo antes con &quot;No es histórico&quot;.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                decidir(
                  async () => {
                    const resultado = await confirmarHistoricos({});
                    return resultado;
                  },
                  cantidad === 1 ? "Quedó confirmado" : `Quedaron confirmados ${total} históricos`,
                  () => setAbierto(false),
                )
              }
            >
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeshacerDecision({
  tipo,
  clave,
  descripcion,
}: {
  tipo: "foto" | "historico";
  clave: string | null;
  descripcion: string;
}) {
  const { pending, decidir } = useDecision();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => decidir(() => deshacerDecisionDelCatalogo({ tipo, clave }), "Quedó deshecho")}
    >
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Undo2 />}
      Deshacer<span className="sr-only">: {descripcion}</span>
    </Button>
  );
}
