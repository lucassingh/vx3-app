"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SidePanelProps = {
  /** Texto del botón que abre el panel. */
  trigger: React.ReactNode;
  /** Nombre accesible del botón ("Ver el pedido V-1043"). */
  triggerLabel: string;
  title: string;
  description?: React.ReactNode;
  /** Contenido renderizado en el servidor (ya formateado). */
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "outline" | "ghost";
};

/** Botón + panel lateral con el detalle de un registro. */
export function SidePanel({
  trigger,
  triggerLabel,
  title,
  description,
  children,
  footer,
  variant = "outline",
}: SidePanelProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" aria-label={triggerLabel}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent variant="side" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="space-y-6">{children}</DialogBody>
        {footer}
      </DialogContent>
    </Dialog>
  );
}
