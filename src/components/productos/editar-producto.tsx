"use client";

import { LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { AltaFotos } from "@/components/productos/alta-fotos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/textarea";
import type { CatalogoEdicion, FotoSubida } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { editarProductoDelCatalogo } from "@/modules/catalog/actions";

const aNumero = (texto: string) => {
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
};

const aTexto = (numero: number) => (numero > 0 ? String(numero) : "");

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * La ficha de un producto, después del corte. Lo que falta acá (nombre, rubro, marca, costo y
 * precio) se sigue cambiando en DUX y en el Hub. El reciclado de SKU es esto: se suma la foto y
 * se ajustan los colores, sin crear otro producto (RN-04).
 */
export function EditarProducto({
  producto,
  mediaUrl,
  puedeEditar,
}: {
  producto: CatalogoEdicion;
  mediaUrl: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const uid = useId();
  const id = (nombre: string) => `${uid}-${nombre}`;
  const [tela, setTela] = useState(producto.tela);
  const [colores, setColores] = useState(producto.colores);
  const [talles, setTalles] = useState(producto.talles);
  const [atributos, setAtributos] = useState(producto.atributos);
  const [peso, setPeso] = useState(aTexto(producto.pesoKg));
  const [medidas, setMedidas] = useState(producto.medidasCm.map(aTexto));
  const [fotos, setFotos] = useState<FotoSubida[]>(producto.fotos);
  const [guardando, startGuardado] = useTransition();

  const guardar = () =>
    startGuardado(async () => {
      const resultado = await editarProductoDelCatalogo({
        sku: producto.sku,
        tela: tela.trim(),
        colores: colores.trim(),
        talles: talles.trim(),
        atributos,
        pesoKg: aNumero(peso),
        medidasCm: medidas.map(aNumero) as [number, number, number],
        fotos,
      });
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error.message });
        return;
      }
      if (resultado.data.aviso) toast.warning("Quedó guardado en la app", { description: resultado.data.aviso });
      else toast.success("Quedó guardado en la app y en la tienda");
      router.refresh();
    });

  const conLista = producto.opcionesDeAtributos.filter(({ opciones }) => opciones.length > 0);
  const libres = producto.opcionesDeAtributos.filter(({ opciones }) => opciones.length === 0);

  return (
    <fieldset className="min-w-0 space-y-6" disabled={!puedeEditar}>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Ficha</CardTitle>
            <CardDescription>
              Nombre, rubro, marca, costo y precio se siguen cambiando en DUX y en el Hub
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id={id("tela")} label="Tela">
              <Input
                id={id("tela")}
                value={tela}
                onChange={(event) => setTela(event.target.value)}
                autoComplete="off"
              />
            </Campo>
            <Campo id={id("talles")} label="Curva de talles">
              <Input
                id={id("talles")}
                value={talles}
                onChange={(event) => setTalles(event.target.value)}
                autoComplete="off"
              />
            </Campo>
            <div className="sm:col-span-2">
              <Campo id={id("colores")} label="Curva de colores">
                <Input
                  id={id("colores")}
                  value={colores}
                  onChange={(event) => setColores(event.target.value)}
                  autoComplete="off"
                />
              </Campo>
            </div>
            {conLista.map(({ clave, label, opciones }) => {
              const actual = atributos[clave] ?? "";
              const lista = actual && !opciones.includes(actual) ? [actual, ...opciones] : opciones;
              return (
                <Campo key={clave} id={id(clave)} label={label}>
                  <NativeSelect
                    id={id(clave)}
                    value={actual}
                    onChange={(event) => setAtributos({ ...atributos, [clave]: event.target.value })}
                  >
                    <option value="">Sin cargar</option>
                    {lista.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {opcion}
                      </option>
                    ))}
                  </NativeSelect>
                </Campo>
              );
            })}
            {libres.map(({ clave, label }) => (
              <Campo key={clave} id={id(clave)} label={label}>
                <Input
                  id={id(clave)}
                  value={atributos[clave] ?? ""}
                  onChange={(event) => setAtributos({ ...atributos, [clave]: event.target.value })}
                  autoComplete="off"
                />
              </Campo>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Medidas y peso del bulto</CardTitle>
            <CardDescription>Con metro y balanza: son obligatorios para cotizar el envío (RN-84)</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-4">
            {(["Largo", "Ancho", "Alto"] as const).map((label, indice) => (
              <Campo key={label} id={id(label)} label={`${label} (cm)`}>
                <Input
                  id={id(label)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={medidas[indice]}
                  onChange={(event) =>
                    setMedidas(medidas.map((valor, i) => (i === indice ? event.target.value : valor)))
                  }
                  className="tabular-nums"
                />
              </Campo>
            ))}
            <Campo id={id("peso")} label="Peso (kg)">
              <Input
                id={id("peso")}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={peso}
                onChange={(event) => setPeso(event.target.value)}
                className="tabular-nums"
              />
            </Campo>
          </div>
        </CardContent>
      </Card>

      <AltaFotos fotos={fotos} mediaUrl={mediaUrl} puedeEditar={puedeEditar} alCambiar={setFotos} />
      {producto.fotosDeDrive > 0 && (
        <p className="text-xs text-muted-foreground">
          Además tiene {producto.fotosDeDrive} {producto.fotosDeDrive === 1 ? "foto" : "fotos"} de Drive, que quedan
          como están.
        </p>
      )}

      {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save />}
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/productos/catalogo?producto=${encodeURIComponent(producto.sku)}`}>Ver la ficha</Link>
          </Button>
        </div>
      )}
    </fieldset>
  );
}
