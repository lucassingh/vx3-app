"use client";

import { LoaderCircle, Save, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/browser";
import type { AlertaPreferencia, CanalAlerta } from "@/lib/api/types";
import { toast } from "@/lib/toast";

const CANALES: { id: CanalAlerta; label: string }[] = [
  { id: "app", label: "En la app" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "mail", label: "Mail" },
];

/** Qué alertas te llegan y por dónde (RF-M0-05). */
export function AlertasForm({ initial }: { initial: AlertaPreferencia[] }) {
  const [guardadas, setGuardadas] = useState(initial);
  const [preferencias, setPreferencias] = useState(initial);
  const [pending, startTransition] = useTransition();
  const cambios = JSON.stringify(preferencias) !== JSON.stringify(guardadas);

  const toggle = (id: string, canal: CanalAlerta, value: boolean) =>
    setPreferencias((current) =>
      current.map((item) => (item.id === id ? { ...item, canales: { ...item.canales, [canal]: value } } : item)),
    );

  const guardar = () => {
    startTransition(async () => {
      try {
        const result = await api.plataforma.preferencias.guardar(preferencias);
        setGuardadas(result);
        setPreferencias(result);
        toast.success("Preferencias de alertas guardadas");
      } catch {
        toast.error("No se pudieron guardar las preferencias", {
          action: { label: "Reintentar", onClick: guardar },
        });
      }
    });
  };

  return (
    <>
      <Table className="min-w-xl">
        <TableHeader>
          <TableRow>
            <TableHead>Alerta</TableHead>
            {CANALES.map((canal) => (
              <TableHead key={canal.id} className="w-28 text-center">
                {canal.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {preferencias.map((alerta) => (
            <TableRow key={alerta.id}>
              <TableCell>
                <p className="font-medium">{alerta.nombre}</p>
                <p className="text-[13px] text-pretty text-muted-foreground">{alerta.descripcion}</p>
              </TableCell>
              {CANALES.map((canal) => (
                <TableCell key={canal.id} className="text-center">
                  <Switch
                    checked={alerta.canales[canal.id]}
                    onCheckedChange={(value) => toggle(alerta.id, canal.id, value)}
                    aria-label={`${alerta.nombre}: ${canal.label}`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardFooter className="flex-wrap justify-between">
        <p className="text-xs text-muted-foreground">
          Por WhatsApp llegan al teléfono de{" "}
          <Link href="/perfil" className="font-medium text-foreground underline-offset-2 hover:underline">
            tu perfil
          </Link>
          .
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!cambios || pending} onClick={() => setPreferencias(guardadas)}>
            <Undo2 />
            Descartar
          </Button>
          <Button size="sm" disabled={!cambios || pending} onClick={guardar}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save />}
            Guardar preferencias
          </Button>
        </div>
      </CardFooter>
    </>
  );
}
