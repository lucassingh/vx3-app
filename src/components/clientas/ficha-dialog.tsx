"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Panel lateral de la ficha. Lo abre `?clienta=` en la URL (se puede
 * compartir el link); al cerrarlo se vuelve a la lista con los mismos filtros.
 */
export function FichaDialog({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        router.replace(closeHref, { scroll: false });
      }}
    >
      <DialogContent variant="side" aria-describedby={undefined} className="max-w-lg">
        {children}
      </DialogContent>
    </Dialog>
  );
}
