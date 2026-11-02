"use client";

import { BellRing, Check, LoaderCircle, Printer, CloudUpload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/browser";
import type { GrupoDespacho, Transporte } from "@/lib/api/types";
import { toast } from "@/lib/toast";

type DespachoAccionProps = {
  transporte: Transporte;
  label: string;
  hechoLabel: string;
  hecho: boolean;
  disabled?: boolean;
  accion: GrupoDespacho["accion"]["id"];
};

const ICON = { zupply: CloudUpload, micorreo: CloudUpload, etiquetas: Printer, aviso: BellRing } as const;

/** Acción del grupo de despacho: subir a Zupply, importar en MiCorreo, imprimir, avisar. */
export function DespachoAccion({ transporte, label, hechoLabel, hecho, disabled, accion }: DespachoAccionProps) {
  const Icon = ICON[accion];
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      try {
        const { mensaje } = await api.envios.accionDespacho(transporte);
        toast.success(hechoLabel, { description: mensaje });
        router.refresh();
      } catch {
        toast.error("No se pudo completar", {
          description: "El sistema del transportista no respondió. Probá de nuevo.",
          action: { label: "Reintentar", onClick: run },
        });
      }
    });
  };

  if (hecho) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Check aria-hidden />
        {hechoLabel}
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={run} disabled={disabled || pending}>
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
      {label}
    </Button>
  );
}
