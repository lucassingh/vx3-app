"use client";

import {
  Check,
  CircleAlert,
  CircleCheck,
  ImagePlus,
  LoaderCircle,
  PackageCheck,
  Recycle,
  RotateCcw,
  Save,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { CatalogoAltaInput, CatalogoAltaOpciones, CatalogoAltaPaso } from "@/lib/api/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { swatchFor } from "@/lib/swatches";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { calcularPresentaciones } from "@/modules/catalog/motor-precios";
import { avisosDeAlta, erroresDeAlta, nombreGenerado, type AltaProblema } from "@/modules/catalog/reglas-alta";

const FOTOS = [
  { tipo: "colores", label: "Todos los colores", hint: "La que manda el bot primero" },
  { tipo: "comercial", label: "Comercial", hint: "Para la vidriera y Tienda Nube" },
  { tipo: "textura", label: "Textura y calidad", hint: "De cerca, con buena luz" },
  { tipo: "detalle", label: "Detalle para IA", hint: "Encaje, aro, etiqueta" },
] as const;

type FotoTipo = (typeof FOTOS)[number]["tipo"];
type PasoEstado = "idle" | "running" | "done" | "error";

const PASOS: { id: CatalogoAltaPaso; label: string }[] = [
  { id: "dux", label: "Crear la prenda y sus packs en DUX" },
  { id: "precios", label: "Cargar los precios en las listas" },
  { id: "tiendanube", label: "Publicar el bulto en Tienda Nube" },
];

const parse = (value: string) => {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : 0;
};

function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Alta de producto en un solo formulario (RF-M1-03 a RF-M1-07). */
export function AltaForm({ opciones }: { opciones: CatalogoAltaOpciones }) {
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [rubro, setRubro] = useState(opciones.rubros[0]?.rubro ?? "");
  const rubroActual = opciones.rubros.find((item) => item.rubro === rubro) ?? opciones.rubros[0];
  const [subrubro, setSubrubro] = useState(rubroActual?.subrubros[0]?.nombre ?? "");
  const subActual = rubroActual?.subrubros.find((item) => item.nombre === subrubro) ?? rubroActual?.subrubros[0];

  const [sku, setSku] = useState(subActual?.proximoSku ?? "");
  const [base, setBase] = useState(subActual?.nombreBase ?? "");
  const [marca, setMarca] = useState("");
  const [detalle, setDetalle] = useState("");
  const [proveedorId, setProveedorId] = useState(opciones.proveedores[0]?.id ?? "");
  const [tela, setTela] = useState("");
  const [colores, setColores] = useState<string[]>([]);
  const [talles, setTalles] = useState("");
  const [aclaracion, setAclaracion] = useState(opciones.aclaraciones[1] ?? "");
  const [costo, setCosto] = useState("");
  const [medidas, setMedidas] = useState<[string, string, string]>(["", "", ""]);
  const [peso, setPeso] = useState("");

  const [reciclado, setReciclado] = useState(false);
  const [skuReciclado, setSkuReciclado] = useState("");
  const [fotos, setFotos] = useState<Partial<Record<FotoTipo, { url: string; nombre: string }>>>({});
  const [intentado, setIntentado] = useState(false);
  const [pasos, setPasos] = useState<Record<CatalogoAltaPaso, PasoEstado>>({
    dux: "idle",
    precios: "idle",
    tiendanube: "idle",
  });
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState<string | null>(null);

  // Libera las vistas previas locales al salir de la pantalla.
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => () => Object.values(fotosRef.current).forEach((foto) => foto && URL.revokeObjectURL(foto.url)), []);

  const familia = rubroActual?.familia ?? "lenceria";
  const nombre = nombreGenerado({ base, marca, detalle, aclaracion, talles });
  const costoDocena = parse(costo);
  const presentaciones = useMemo(
    () => calcularPresentaciones(familia, sku.trim().toUpperCase(), costoDocena),
    [familia, sku, costoDocena],
  );

  const input: CatalogoAltaInput = {
    sku: sku.trim().toUpperCase(),
    rubro,
    subrubro,
    nombre,
    marca: marca.trim(),
    proveedorId,
    tela,
    colores,
    talles: talles.trim(),
    aclaracion,
    costoDocena,
    pesoBultoKg: parse(peso),
    medidasCm: medidas.map(parse) as [number, number, number],
  };

  const skusExistentes = opciones.skus.map((item) => item.sku);
  const errores = erroresDeAlta(input, skusExistentes);
  const avisos = avisosDeAlta(input, opciones.marcas);
  if (!fotos.colores)
    avisos.push({
      campo: "fotos",
      mensaje: "Sin la foto de todos los colores, Tienda Nube no publica el bulto (RN-09).",
    });

  const errorDe = (campo: AltaProblema["campo"]) =>
    intentado ? errores.find((item) => item.campo === campo)?.mensaje : undefined;
  const invalid = (campo: AltaProblema["campo"]) =>
    errorDe(campo) ? { "aria-invalid": true, "aria-describedby": `${id(campo)}-error` } : {};

  const elegirSubrubro = (rubroNombre: string, subNombre: string) => {
    const nuevoRubro = opciones.rubros.find((item) => item.rubro === rubroNombre);
    const nuevoSub = nuevoRubro?.subrubros.find((item) => item.nombre === subNombre) ?? nuevoRubro?.subrubros[0];
    setRubro(rubroNombre);
    setSubrubro(nuevoSub?.nombre ?? "");
    setSku(nuevoSub?.proximoSku ?? "");
    setBase(nuevoSub?.nombreBase ?? "");
  };

  const toggleColor = (color: string) =>
    setColores((actual) => (actual.includes(color) ? actual.filter((item) => item !== color) : [...actual, color]));

  const cargarFoto = (tipo: FotoTipo, file: File | undefined) => {
    setFotos((actual) => {
      const previa = actual[tipo];
      if (previa) URL.revokeObjectURL(previa.url);
      return { ...actual, [tipo]: file ? { url: URL.createObjectURL(file), nombre: file.name } : undefined };
    });
  };

  const publicar = () => {
    setIntentado(true);
    if (errores.length > 0) {
      toast.error(
        errores.length === 1 ? "Falta 1 dato para publicar" : `Faltan ${errores.length} datos para publicar`,
        { description: errores[0]?.mensaje },
      );
      return;
    }

    const run = async () => {
      setPublicando(true);
      for (const paso of PASOS) {
        setPasos((actual) => ({ ...actual, [paso.id]: "running" }));
        try {
          await api.catalogo.publicar(input, paso.id);
          setPasos((actual) => ({ ...actual, [paso.id]: "done" }));
        } catch (error) {
          setPasos((actual) => ({ ...actual, [paso.id]: "error" }));
          throw error;
        }
      }
      return input.sku;
    };

    const promise = run();
    toast.promise(promise, {
      loading: `Publicando ${input.sku}…`,
      success: (skuPublicado) => ({
        message: `${skuPublicado} publicado en DUX y Tienda Nube`,
        description: `Se crearon ${presentaciones.length} códigos con sus precios.`,
      }),
      error: (error) => (error instanceof Error ? error.message : "No se pudo publicar el producto"),
    });
    promise
      .then((skuPublicado) => setPublicado(skuPublicado))
      .catch(() => {})
      .finally(() => setPublicando(false));
  };

  const guardarBorrador = () => {
    toast.promise(api.catalogo.guardarBorrador(input), {
      loading: "Guardando el borrador…",
      success: (resultado) => ({ message: `Borrador ${resultado.sku} guardado`, description: resultado.detalle }),
      error: (error) => (error instanceof Error ? error.message : "No se pudo guardar el borrador"),
    });
  };

  const sumarFotos = () => {
    if (!skuReciclado) {
      toast.error("Elegí el SKU existente", { description: "Las fotos nuevas se suman a ese producto." });
      return;
    }
    toast.success(`Fotos sumadas a ${skuReciclado}`, {
      description: "El nombre pasa a llevar “colores sujetos a stock”. No se creó un SKU nuevo (RN-04).",
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Clasificación</CardTitle>
              <CardDescription>
                Rubro, subrubro y marca tienen que existir en DUX escritos igual (RN-07)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
              <Recycle aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label htmlFor={id("reciclado")}>¿Es el mismo producto con otros colores?</Label>
                <p className="text-xs text-muted-foreground">
                  Misma tela, corte y fabricante: no se crea SKU, se suman las fotos (RN-04). Si cambia el corte, la
                  tela o un detalle, va SKU nuevo.
                </p>
              </div>
              <Switch id={id("reciclado")} checked={reciclado} onCheckedChange={setReciclado} />
            </div>

            {reciclado ? (
              <Field
                id={id("sku-reciclado")}
                label="Producto existente"
                hint="Se le suma la foto nueva y se ajusta la aclaración del nombre."
              >
                <NativeSelect
                  id={id("sku-reciclado")}
                  value={skuReciclado}
                  onChange={(event) => setSkuReciclado(event.target.value)}
                >
                  <option value="">Elegí el SKU</option>
                  {opciones.skus.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} · {item.nombre}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={id("rubro")} label="Rubro">
                  <NativeSelect
                    id={id("rubro")}
                    value={rubro}
                    onChange={(event) => elegirSubrubro(event.target.value, "")}
                  >
                    {opciones.rubros.map((item) => (
                      <option key={item.rubro} value={item.rubro}>
                        {item.rubro}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id={id("subrubro")} label="Subrubro" error={errorDe("subrubro")}>
                  <NativeSelect
                    id={id("subrubro")}
                    value={subrubro}
                    onChange={(event) => elegirSubrubro(rubro, event.target.value)}
                    {...invalid("subrubro")}
                  >
                    {rubroActual?.subrubros.map((item) => (
                      <option key={item.nombre} value={item.nombre}>
                        {item.nombre}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  id={id("sku")}
                  label="SKU"
                  error={errorDe("sku")}
                  hint={
                    <>
                      Próximo correlativo de <span className="font-mono">{subActual?.prefijo}</span> en DUX. La
                      terminación del pack la agrega el sistema.
                    </>
                  }
                >
                  <div className="relative">
                    <Input
                      id={id("sku")}
                      value={sku}
                      onChange={(event) => setSku(event.target.value.toUpperCase())}
                      className="pr-24 font-mono uppercase"
                      autoComplete="off"
                      {...invalid("sku")}
                    />
                    {sku === subActual?.proximoSku ? (
                      <Badge variant="primary" className="absolute top-1/2 right-2 -translate-y-1/2">
                        Sugerido
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2"
                        aria-label="Volver al SKU sugerido"
                        onClick={() => setSku(subActual?.proximoSku ?? "")}
                      >
                        <RotateCcw />
                      </Button>
                    )}
                  </div>
                </Field>
                <Field id={id("proveedor")} label="Proveedor">
                  <NativeSelect
                    id={id("proveedor")}
                    value={proveedorId}
                    onChange={(event) => setProveedorId(event.target.value)}
                  >
                    {opciones.proveedores.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            )}
          </CardContent>
        </Card>

        {!reciclado && (
          <>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Nombre y atributos</CardTitle>
                  <CardDescription>
                    Con vocabulario controlado: así el bot y la vidriera pueden filtrar por talle, color y tela
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={id("base")} label="Producto" error={errorDe("nombre")}>
                    <Input
                      id={id("base")}
                      value={base}
                      onChange={(event) => setBase(event.target.value)}
                      {...invalid("nombre")}
                    />
                  </Field>
                  <Field id={id("marca")} label="Marca" hint="Elegí una de las que existen en DUX.">
                    <Input
                      id={id("marca")}
                      list={id("marcas")}
                      value={marca}
                      onChange={(event) => setMarca(event.target.value)}
                      placeholder="Ej. AmorArma"
                      autoComplete="off"
                    />
                    <datalist id={id("marcas")}>
                      {opciones.marcas.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </Field>
                  <Field
                    id={id("detalle")}
                    label="Detalle significativo"
                    hint="Solo si distingue al producto: “con aro y push up”."
                  >
                    <Input
                      id={id("detalle")}
                      value={detalle}
                      onChange={(event) => setDetalle(event.target.value)}
                      placeholder="Ej. con puntilla"
                    />
                  </Field>
                  <Field id={id("tela")} label="Tela">
                    <NativeSelect id={id("tela")} value={tela} onChange={(event) => setTela(event.target.value)}>
                      <option value="">Sin tela</option>
                      {opciones.telas.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field id={id("talles")} label="Curva de talles" error={errorDe("talles")}>
                    <Input
                      id={id("talles")}
                      value={talles}
                      onChange={(event) => setTalles(event.target.value)}
                      placeholder="Ej. 90 a 105"
                      {...invalid("talles")}
                    />
                  </Field>
                </div>

                <fieldset
                  className="space-y-2"
                  aria-describedby={errorDe("colores") ? `${id("colores")}-error` : undefined}
                >
                  <legend className="text-[13px] font-medium">
                    Curva de colores{" "}
                    <span className="font-normal text-muted-foreground">· {colores.length} elegidos</span>
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {opciones.colores.map((color) => {
                      const activo = colores.includes(color);
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => toggleColor(color)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] transition-[background-color,border-color,scale] duration-150 ease-snappy active:scale-[0.96]",
                            activo
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border-strong bg-surface hover:bg-muted",
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-3 rounded-full ring-1 ring-foreground/15"
                            style={{ background: swatchFor(color) }}
                          />
                          {color}
                          {activo && <Check aria-hidden className="size-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  {errorDe("colores") && (
                    <p id={`${id("colores")}-error`} className="text-xs font-medium text-danger">
                      {errorDe("colores")}
                    </p>
                  )}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-[13px] font-medium">Aclaración anti-reclamo (RN-06)</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {opciones.aclaraciones.map((item) => (
                      <label
                        key={item}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                          aclaracion === item ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <input
                          type="radio"
                          name={id("aclaracion")}
                          value={item}
                          checked={aclaracion === item}
                          onChange={() => setAclaracion(item)}
                          className="mt-0.5 accent-(--primary)"
                        />
                        <span className="first-letter:uppercase">{item}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Costo y precios</CardTitle>
                  <CardDescription>
                    El costo vive en la prenda (docena ÷ 12) y el motor calcula el piso de cada pack, redondeado hacia
                    arriba a $ 100
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <Field id={id("costo")} label="Costo de la docena" error={errorDe("costoDocena")} className="max-w-xs">
                  <div className="relative">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                    >
                      $
                    </span>
                    <Input
                      id={id("costo")}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={100}
                      value={costo}
                      onChange={(event) => setCosto(event.target.value)}
                      placeholder="45000"
                      className="pl-7 tabular-nums"
                      {...invalid("costoDocena")}
                    />
                  </div>
                </Field>
              </CardContent>
              <div className="relative w-full overflow-x-auto border-t border-border">
                <table className="w-full min-w-xl text-sm">
                  <caption className="sr-only">Presentaciones con sus precios calculados</caption>
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 pl-5 font-medium">
                        Código
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Presentación
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Coeficiente
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Precio
                      </th>
                      <th scope="col" className="px-3 py-2.5 pr-5 font-medium">
                        Listas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {presentaciones.map((item) => (
                      <tr key={item.codigo}>
                        <td className="px-3 py-3 pl-5 font-mono text-xs">{item.codigo}</td>
                        <td className="px-3 py-3">
                          {item.label}
                          {item.esBulto && (
                            <Badge variant="primary" className="ml-2">
                              Bulto
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                          × {formatNumber(item.coeficiente, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {costoDocena > 0 ? formatCurrency(item.precio) : "—"}
                        </td>
                        <td className="px-3 py-3 pr-5 text-xs text-muted-foreground">{item.listas.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Medidas y peso del bulto</CardTitle>
                  <CardDescription>
                    Con metro y balanza: son obligatorios para cotizar el envío bulto por bulto (RN-84)
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="grid gap-4 sm:grid-cols-4">
                  {(["Largo", "Ancho", "Alto"] as const).map((label, index) => (
                    <Field key={label} id={id(`medida-${index}`)} label={`${label} (cm)`}>
                      <Input
                        id={id(`medida-${index}`)}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={medidas[index]}
                        onChange={(event) =>
                          setMedidas((actual) => {
                            const next = [...actual] as [string, string, string];
                            next[index] = event.target.value;
                            return next;
                          })
                        }
                        className="tabular-nums"
                        {...invalid("medidasCm")}
                      />
                    </Field>
                  ))}
                  <Field id={id("peso")} label="Peso (kg)" error={errorDe("pesoBultoKg")}>
                    <Input
                      id={id("peso")}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={peso}
                      onChange={(event) => setPeso(event.target.value)}
                      placeholder="0,70"
                      className="tabular-nums"
                      {...invalid("pesoBultoKg")}
                    />
                  </Field>
                </div>
                {errorDe("medidasCm") && (
                  <p id={`${id("medidasCm")}-error`} className="mt-3 text-xs font-medium text-danger">
                    {errorDe("medidasCm")}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Fotos</CardTitle>
              <CardDescription>
                Las cuatro de RN-08, con su tipo. Se acabó la convención de nombres en Drive: la app las ordena y
                recorta sola
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {FOTOS.map((foto) => {
                const cargada = fotos[foto.tipo];
                return (
                  <li key={foto.tipo} className="space-y-2">
                    <label
                      className={cn(
                        "relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                        cargada ? "border-border" : "border-dashed border-border-strong bg-canvas/60 hover:bg-muted",
                      )}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label={`Foto: ${foto.label}`}
                        onChange={(event) => cargarFoto(foto.tipo, event.target.files?.[0])}
                      />
                      {cargada ? (
                        // Vista previa local (blob:), no pasa por el optimizador de imágenes.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cargada.url}
                          alt={`Vista previa: ${foto.label}`}
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <>
                          <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
                          <span className="px-2 text-xs text-muted-foreground">Arrastrá o elegí una foto</span>
                        </>
                      )}
                    </label>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{foto.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{cargada ? cargada.nombre : foto.hint}</p>
                      </div>
                      {cargada && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Quitar la foto ${foto.label}`}
                          onClick={() => cargarFoto(foto.tipo, undefined)}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start" aria-label="Resumen del alta">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{reciclado ? "Reciclado de SKU" : "Así va a quedar"}</CardTitle>
              <CardDescription>
                {reciclado
                  ? "Las fotos se suman al producto que ya existe"
                  : "Nombre según la regla RN-05, con la terminación de cada pack"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {reciclado ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {skuReciclado ? (
                    <>
                      Se suman{" "}
                      <span className="font-medium text-foreground">
                        {Object.values(fotos).filter(Boolean).length} fotos
                      </span>{" "}
                      a <span className="font-mono text-foreground">{skuReciclado}</span> y su nombre pasa a decir
                      “colores sujetos a stock”.
                    </>
                  ) : (
                    "Elegí el producto existente y cargá las fotos nuevas."
                  )}
                </p>
                <Button className="w-full" onClick={sumarFotos}>
                  <Upload />
                  Sumar fotos{skuReciclado ? ` a ${skuReciclado}` : ""}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed wrap-anywhere">
                    {nombre || "Completá el producto para ver el nombre"}
                  </p>
                  {nombre && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {presentaciones.map((item) => (
                        <li key={item.codigo} className="flex justify-between gap-3">
                          <span className="font-mono">{item.codigo}</span>
                          <span className="truncate">… - {item.terminacion}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  {errores.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm font-medium text-success">
                      <CircleCheck aria-hidden className="size-4" />
                      Todo listo para publicar
                    </p>
                  ) : (
                    <>
                      <p className="text-[13px] font-medium">
                        Para publicar {errores.length === 1 ? "falta 1 dato" : `faltan ${errores.length} datos`}
                      </p>
                      <ul className="space-y-1.5">
                        {errores.map((item) => (
                          <li key={item.mensaje} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-danger" />
                            {item.mensaje}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {avisos.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {avisos.map((item) => (
                        <li key={item.mensaje} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
                          {item.mensaje}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <ol className="space-y-2 border-t border-border pt-4" aria-label="Pasos de la publicación">
                  {PASOS.map((paso) => {
                    const estado = pasos[paso.id];
                    return (
                      <li key={paso.id} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full border",
                            estado === "done" && "border-success bg-success text-surface",
                            estado === "error" && "border-danger bg-danger text-surface",
                            estado === "running" && "border-primary text-primary",
                            estado === "idle" && "border-border-strong text-muted-foreground",
                          )}
                        >
                          {estado === "done" ? (
                            <Check aria-hidden className="size-3" strokeWidth={3} />
                          ) : estado === "running" ? (
                            <LoaderCircle aria-hidden className="size-3 animate-spin" />
                          ) : estado === "error" ? (
                            <X aria-hidden className="size-3" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span className={cn(estado === "idle" && "text-muted-foreground")}>{paso.label}</span>
                        <span className="sr-only">
                          {estado === "done"
                            ? ": hecho"
                            : estado === "running"
                              ? ": en curso"
                              : estado === "error"
                                ? ": falló"
                                : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {publicado ? (
                  <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-3.5" role="status">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <PackageCheck aria-hidden className="size-4 text-success" />
                      {publicado} quedó publicado
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/productos/catalogo?q=${encodeURIComponent(publicado)}`}>Ver en el catálogo</Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => router.refresh()}>
                        Cargar otro
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button onClick={publicar} disabled={publicando}>
                      {publicando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Upload />}
                      {publicando ? "Publicando…" : "Publicar en DUX y Tienda Nube"}
                    </Button>
                    <Button variant="outline" onClick={guardarBorrador} disabled={publicando}>
                      <Save />
                      Guardar borrador
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
