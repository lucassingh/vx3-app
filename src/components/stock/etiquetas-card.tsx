"use client";

import { FileDown, LoaderCircle, Tags } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import { toast } from "@/lib/toast";

/** Etiquetas del salón en PDF con los precios vigentes, sin bajar listas (RF-M2-07, RN-107). */
export function EtiquetasCard({ rubros }: { rubros: string[] }) {
  const selectId = useId();
  const [rubro, setRubro] = useState("");
  const [pending, setPending] = useState(false);

  const generar = async () => {
    setPending(true);
    try {
      const resultado = await api.stock.etiquetas(rubro || undefined);
      toast.success(`${resultado.etiquetas} etiquetas listas para imprimir`, {
        description: `${resultado.archivo}${resultado.sinPrecio > 0 ? ` · ${resultado.sinPrecio} producto sin precio en alguna lista quedó aparte` : ""}`,
      });
    } catch {
      toast.error("No se pudieron generar las etiquetas", { description: "Probá de nuevo en un momento." });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tags aria-hidden className="size-4 text-primary" />
            Etiquetas del salón
          </CardTitle>
          <CardDescription>
            Con los dos precios del local: TARJETA/QR y EF/TR, tomados de DUX en el momento
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <ul className="space-y-1.5 text-[13px] text-muted-foreground">
          <li>El bulto lleva el precio por docena y una etiqueta por docena.</li>
          <li>La prenda, el pack minorista y el combo, una etiqueta por unidad.</li>
          <li>Código de barras de DUX o el SKU completado con ceros.</li>
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor={selectId}>Rubro</Label>
            <NativeSelect id={selectId} value={rubro} onChange={(event) => setRubro(event.target.value)}>
              <option value="">Todo el salón</option>
              {rubros.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button onClick={generar} disabled={pending}>
            {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <FileDown />}
            Generar PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
