"use client";

import {
  Check,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { AltaBorradores } from "@/components/productos/alta-borradores";
import { AltaFotos } from "@/components/productos/alta-fotos";
import { AltaParecidos } from "@/components/productos/alta-parecidos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/textarea";
import { api } from "@/lib/api/browser";
import type { CatalogoAltaInput, CatalogoAltaOpciones, CatalogoAltaPaso, CatalogoBorrador } from "@/lib/api/types";
import { formatCurrency, formatNumber, formatTime } from "@/lib/format";
import { swatchFor } from "@/lib/swatches";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { guardarBorradorDeAlta } from "@/modules/catalog/actions";
import { aFormatoDeNombre, nombreDelProducto, presentacionesDelAlta } from "@/modules/catalog/alta";
import type { OpcionalesDeAlta } from "@/modules/catalog/motor-precios";
import { avisosDeAlta, erroresDeAlta, type AltaProblema } from "@/modules/catalog/reglas-alta";

type PasoEstado = "idle" | "running" | "done" | "error";

const PASOS: { id: CatalogoAltaPaso; label: string }[] = [
  { id: "dux", label: "Crear la prenda y sus packs en DUX" },
  { id: "precios", label: "Cargar los precios en las listas" },
  { id: "tiendanube", label: "Publicar el bulto en Tienda Nube" },
];

/** Lo que dice el nombre sobre los colores (RN-127). */
const COLORES_DEL_NOMBRE = ["COLORES BASICOS", "COLORES Y DISEÑOS DE LA FOTO", "COLORES SURTIDOS"];
const COLOR_PUNTUAL = "puntual";

/** La copa va en el nombre: el resto de los atributos, solo en la ficha. */
const COPA = "copa";
const SIN_COPA = "No corresponde";

/** Las presentaciones que no todos los productos tienen (RN-01). */
const OPCIONALES: Record<"lenceria" | "medias", { clave: keyof OpcionalesDeAlta; label: string; hint: string }[]> = {
  lenceria: [
    { clave: "tres", label: "Pack de 3", hint: "Lo decide VX3: hoy lo tienen pocos productos" },
    { clave: "docena", label: "Una docena", hint: "Va en las dos listas" },
  ],
  medias: [{ clave: "dosDocenas", label: "Dos docenas", hint: "Va en las dos listas" }],
};

const parse = (value: string) => {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : 0;
};

const aTexto = (numero: number | undefined) => (numero ? String(numero) : "");

type Campos = {
  rubro: string;
  subrubro: string;
  sku: string;
  prenda: string;
  marca: string;
  proveedorId: string;
  tela: string;
  talles: string;
  copa: string;
  colorModo: string;
  colorPuntual: string;
  colores: string[];
  atributos: Record<string, string>;
  opcionales: OpcionalesDeAlta;
  costo: string;
  peso: string;
  medidas: [string, string, string];
  fotos: CatalogoAltaInput["fotos"];
};

function camposDe(input?: CatalogoAltaInput): Campos {
  const color = input?.color ?? "";
  const esDeLaLista = COLORES_DEL_NOMBRE.includes(color);
  return {
    rubro: input?.rubro ?? "",
    subrubro: input?.subrubro ?? "",
    sku: input?.sku ?? "",
    prenda: input?.prenda ?? "",
    marca: input?.marca ?? "",
    proveedorId: input?.proveedorId ?? "",
    tela: input?.tela ?? "",
    talles: input?.talles ?? "",
    copa: input?.copa ?? "",
    colorModo: esDeLaLista ? color : color ? COLOR_PUNTUAL : "",
    colorPuntual: esDeLaLista ? "" : color,
    colores: input?.colores ?? [],
    atributos: input?.atributos ?? {},
    opcionales: input?.opcionales ?? {},
    costo: aTexto(input?.costoDocena),
    peso: aTexto(input?.pesoBultoKg),
    medidas: [aTexto(input?.medidasCm[0]), aTexto(input?.medidasCm[1]), aTexto(input?.medidasCm[2])],
    fotos: input?.fotos ?? [],
  };
}

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

/** Sin recargar: lo que hay en pantalla, y las fotos locales, no se pierden al guardar. */
const marcarEnLaUrl = (borradorId: string | null) =>
  window.history.replaceState(null, "", borradorId ? `?borrador=${borradorId}` : window.location.pathname);

/**
 * Alta de producto en un solo formulario (RF-M1-03 a RF-M1-07). Cada borrador abierto es un
 * formulario nuevo: se arma de cero con lo guardado.
 */
export function AltaForm({
  opciones,
  borradores: iniciales,
  abierto,
  real,
  puedeEditar,
}: {
  opciones: CatalogoAltaOpciones;
  borradores: CatalogoBorrador[];
  abierto: CatalogoBorrador | null;
  /** Con el catálogo real, publicar todavía no existe: llega en los próximos pasos de esta fase. */
  real: boolean;
  puedeEditar: boolean;
}) {
  const [borradores, setBorradores] = useState(iniciales);
  const [abiertoId, setAbiertoId] = useState(abierto?.id ?? null);
  const [formulario, setFormulario] = useState({ clave: 0, input: abierto?.input });

  const abrir = (borrador: CatalogoBorrador | null) => {
    setAbiertoId(borrador?.id ?? null);
    setFormulario(({ clave }) => ({ clave: clave + 1, input: borrador?.input }));
    marcarEnLaUrl(borrador?.id ?? null);
    window.scrollTo({ top: 0 });
  };

  const alGuardar = (borrador: CatalogoBorrador) => {
    setAbiertoId(borrador.id);
    setBorradores((actuales) => [borrador, ...actuales.filter(({ id }) => id !== borrador.id)]);
    marcarEnLaUrl(borrador.id);
  };

  const alBorrar = ({ id }: CatalogoBorrador) => {
    setBorradores((actuales) => actuales.filter((borrador) => borrador.id !== id));
    if (id === abiertoId) abrir(null);
  };

  return (
    <div className="space-y-6">
      <AltaBorradores
        borradores={borradores}
        abiertoId={abiertoId}
        puedeEditar={puedeEditar}
        alAbrir={abrir}
        alBorrar={alBorrar}
      />
      <Formulario
        key={formulario.clave}
        opciones={opciones}
        inicial={formulario.input}
        borradorId={abiertoId}
        real={real}
        puedeEditar={puedeEditar}
        alGuardar={alGuardar}
      />
    </div>
  );
}

function Formulario({
  opciones,
  inicial,
  borradorId,
  real,
  puedeEditar,
  alGuardar,
}: {
  opciones: CatalogoAltaOpciones;
  inicial?: CatalogoAltaInput;
  borradorId: string | null;
  real: boolean;
  puedeEditar: boolean;
  alGuardar: (borrador: CatalogoBorrador) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [campos, setCampos] = useState(() => camposDe(inicial));
  const cambiar = <K extends keyof Campos>(campo: K, valor: Campos[K]) =>
    setCampos((actuales) => ({ ...actuales, [campo]: valor }));

  const rubroActual = opciones.rubros.find((item) => item.rubro === campos.rubro);
  const subActual = rubroActual?.subrubros.find((item) => item.nombre === campos.subrubro);

  const [otroColor, setOtroColor] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [pasos, setPasos] = useState<Record<CatalogoAltaPaso, PasoEstado>>({
    dux: "idle",
    precios: "idle",
    tiendanube: "idle",
  });
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState<string | null>(null);
  const [guardando, startGuardado] = useTransition();
  const [guardadoA, setGuardadoA] = useState<string | null>(null);

  const familia = rubroActual?.familia ?? "lenceria";
  const esMedias = familia === "medias";
  const sku = campos.sku.trim().toUpperCase();
  const copa = esMedias ? "" : campos.copa;
  const color = campos.colorModo === COLOR_PUNTUAL ? aFormatoDeNombre(campos.colorPuntual) : campos.colorModo;
  const nombre = campos.prenda.trim()
    ? nombreDelProducto({
        prenda: campos.prenda,
        marca: campos.marca,
        talles: campos.talles,
        copa: copa === SIN_COPA ? "" : copa,
        color,
      })
    : "";
  const costoDocena = parse(campos.costo);
  const presentaciones = presentacionesDelAlta({
    sku: sku || "SKU",
    rubro: campos.rubro,
    nombre,
    costoDocena,
    opcionales: campos.opcionales,
  });

  const input: CatalogoAltaInput = {
    sku,
    rubro: campos.rubro,
    subrubro: campos.subrubro,
    nombre,
    prenda: aFormatoDeNombre(campos.prenda),
    color,
    copa,
    marca: campos.marca,
    proveedorId: campos.proveedorId,
    tela: campos.tela.trim(),
    colores: campos.colores,
    talles: campos.talles.trim(),
    atributos: esMedias ? {} : campos.atributos,
    opcionales: campos.opcionales,
    costoDocena,
    pesoBultoKg: parse(campos.peso),
    medidasCm: campos.medidas.map(parse) as [number, number, number],
    fotos: campos.fotos,
  };

  const subrubrosDeDux = opciones.rubros.flatMap(({ rubro, subrubros }) =>
    subrubros.map(({ nombre: subrubro }) => ({ rubro, subrubro })),
  );
  const errores = erroresDeAlta(input, [], { codigosUsados: opciones.codigosUsados, subrubrosDeDux });
  const avisos = avisosDeAlta(input, opciones.marcas, subActual?.prefijo);
  if (campos.fotos.length === 0)
    avisos.push({ campo: "fotos", mensaje: "Sin foto, Tienda Nube no publica el bulto (RN-09)." });

  const errorDe = (campo: AltaProblema["campo"]) =>
    intentado ? errores.find((item) => item.campo === campo)?.mensaje : undefined;
  const invalid = (campo: AltaProblema["campo"]) =>
    errorDe(campo) ? { "aria-invalid": true, "aria-describedby": `${id(campo)}-error` } : {};

  const elegirRubro = (rubro: string) =>
    setCampos((actuales) => ({ ...actuales, rubro, subrubro: "", sku: "", opcionales: {} }));

  const elegirSubrubro = (subrubro: string) => {
    const nuevo = rubroActual?.subrubros.find((item) => item.nombre === subrubro);
    setCampos((actuales) => ({ ...actuales, subrubro, sku: nuevo?.proximoSku ?? "" }));
  };

  const toggleColor = (valor: string) =>
    cambiar(
      "colores",
      campos.colores.includes(valor) ? campos.colores.filter((item) => item !== valor) : [...campos.colores, valor],
    );

  const agregarColor = () => {
    const valor = aFormatoDeNombre(otroColor);
    if (!valor) return;
    if (!campos.colores.includes(valor)) cambiar("colores", [...campos.colores, valor]);
    setOtroColor("");
  };

  const revisar = () => {
    setIntentado(true);
    if (errores.length > 0) {
      toast.error(errores.length === 1 ? "Falta 1 dato" : `Faltan ${errores.length} datos`, {
        description: errores[0]?.mensaje,
      });
      return false;
    }
    return true;
  };

  const publicar = () => {
    if (!revisar()) return;

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

  const revisarSinPublicar = () => {
    if (revisar())
      toast.success("Está completo", { description: "Guardalo como borrador hasta que se pueda publicar." });
  };

  const guardar = () =>
    startGuardado(async () => {
      const resultado = await guardarBorradorDeAlta({ id: borradorId, input });
      if (!resultado.ok) {
        toast.error("No se pudo guardar el borrador", { description: resultado.error.message });
        return;
      }
      alGuardar(resultado.data);
      setGuardadoA(resultado.data.cuando);
      toast.success("Borrador guardado", { description: "No se publicó en ningún lado." });
    });

  const atributosConLista = opciones.atributos.filter(
    ({ clave, opciones: lista }) => clave !== COPA && lista.length > 0,
  );
  const atributosLibres = opciones.atributos.filter(({ opciones: lista }) => lista.length === 0);
  const opcionesDeCopa = opciones.atributos.find(({ clave }) => clave === COPA)?.opciones ?? [];
  // Un borrador puede traer un valor que ya no está en la lista: se muestra, y el aviso dice qué pasa.
  const marcas =
    campos.marca && !opciones.marcas.includes(campos.marca) ? [campos.marca, ...opciones.marcas] : opciones.marcas;
  const chips = [...opciones.colores, ...campos.colores.filter((item) => !opciones.colores.includes(item))];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Clasificación</CardTitle>
              <CardDescription>Rubro, subrubro y proveedor salen de DUX: la app no los crea (RN-07)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("rubro")} label="Rubro">
                <NativeSelect
                  id={id("rubro")}
                  value={campos.rubro}
                  onChange={(event) => elegirRubro(event.target.value)}
                >
                  <option value="">Elegí el rubro</option>
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
                  value={campos.subrubro}
                  onChange={(event) => elegirSubrubro(event.target.value)}
                  disabled={!rubroActual}
                  {...invalid("subrubro")}
                >
                  <option value="">{rubroActual ? "Elegí el subrubro" : "Primero el rubro"}</option>
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
                  subActual?.prefijo ? (
                    <>
                      El próximo libre de <span className="font-mono">{subActual.prefijo}</span>, contando los
                      inhabilitados. La cantidad la agrega cada presentación.
                    </>
                  ) : subActual ? (
                    "Este subrubro todavía no tiene prefijo: lo define VX3 (RN-03). Escribí el código entero."
                  ) : (
                    "Elegí el subrubro y se sugiere el próximo."
                  )
                }
              >
                <div className="relative">
                  <Input
                    id={id("sku")}
                    value={campos.sku}
                    onChange={(event) => cambiar("sku", event.target.value.toUpperCase())}
                    className="pr-24 font-mono uppercase"
                    autoComplete="off"
                    {...invalid("sku")}
                  />
                  {subActual?.proximoSku &&
                    (sku === subActual.proximoSku ? (
                      <Badge variant="primary" className="absolute top-1/2 right-2 -translate-y-1/2">
                        Sugerido
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-1.5 -translate-y-1/2"
                        aria-label={`Volver al SKU sugerido, ${subActual.proximoSku}`}
                        onClick={() => cambiar("sku", subActual.proximoSku ?? "")}
                      >
                        <RotateCcw />
                      </Button>
                    ))}
                </div>
              </Field>
              <Field id={id("proveedorId")} label="Proveedor" error={errorDe("proveedorId")}>
                <NativeSelect
                  id={id("proveedorId")}
                  value={campos.proveedorId}
                  onChange={(event) => cambiar("proveedorId", event.target.value)}
                  {...invalid("proveedorId")}
                >
                  <option value="">Elegí el proveedor</option>
                  {[
                    { label: "Con productos", lista: opciones.proveedores.filter((item) => item.conProductos) },
                    { label: "Otros en DUX", lista: opciones.proveedores.filter((item) => !item.conProductos) },
                  ].map(
                    ({ label, lista }) =>
                      lista.length > 0 && (
                        <optgroup key={label} label={label}>
                          {lista.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nombre}
                            </option>
                          ))}
                        </optgroup>
                      ),
                  )}
                </NativeSelect>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Nombre y atributos</CardTitle>
              <CardDescription>
                El nombre lo arma la app con estas partes, y así el bot y la vidriera pueden filtrar
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={id("prenda")}
                label="Prenda y detalle"
                error={errorDe("prenda") ?? errores.find(({ campo }) => campo === "nombre")?.mensaje}
                hint="Solo lo que distingue al producto, sin precios ni promociones."
                className="sm:col-span-2"
              >
                <Input
                  id={id("prenda")}
                  value={campos.prenda}
                  onChange={(event) => cambiar("prenda", event.target.value)}
                  placeholder="Ej. TOP SEGUNDA PIEL TIRA ANCHA"
                  autoComplete="off"
                  {...invalid("prenda")}
                />
              </Field>
              <AltaParecidos
                busqueda={[campos.prenda, campos.marca].filter(Boolean).join(" ")}
                rubro={campos.rubro}
                subrubro={campos.subrubro}
              />
              <Field id={id("marca")} label="Marca" hint="Las que existen en DUX. Una nueva se crea primero allá.">
                <NativeSelect
                  id={id("marca")}
                  value={campos.marca}
                  onChange={(event) => cambiar("marca", event.target.value)}
                >
                  <option value="">Sin marca</option>
                  {marcas.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id={id("tela")} label="Tela" hint="Las más usadas primero. Si es otra, escribila.">
                <Input
                  id={id("tela")}
                  list={id("telas")}
                  value={campos.tela}
                  onChange={(event) => cambiar("tela", event.target.value)}
                  autoComplete="off"
                />
                <datalist id={id("telas")}>
                  {opciones.telas.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </Field>
              <Field
                id={id("talles")}
                label="Curva de talles"
                error={errorDe("talles")}
                hint="“M A 2XL” es una curva; “L/XL”, un talle."
              >
                <Input
                  id={id("talles")}
                  value={campos.talles}
                  onChange={(event) => cambiar("talles", event.target.value)}
                  placeholder="Ej. M A 2XL"
                  autoComplete="off"
                  {...invalid("talles")}
                />
              </Field>
              {!esMedias && opcionesDeCopa.length > 0 && (
                <Field id={id("copa")} label="Copa" hint="Va en el nombre.">
                  <NativeSelect
                    id={id("copa")}
                    value={campos.copa}
                    onChange={(event) => cambiar("copa", event.target.value)}
                  >
                    <option value="">Sin cargar</option>
                    {opcionesDeCopa.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>

            <fieldset className="space-y-2" aria-describedby={errorDe("color") ? `${id("color")}-error` : undefined}>
              <legend className="text-[13px] font-medium">Qué dice el nombre sobre los colores</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[...COLORES_DEL_NOMBRE, COLOR_PUNTUAL].map((item) => (
                  <label
                    key={item}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring",
                      campos.colorModo === item ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="radio"
                      name={id("color")}
                      value={item}
                      checked={campos.colorModo === item}
                      onChange={() => cambiar("colorModo", item)}
                      className="mt-0.5 accent-(--primary)"
                    />
                    <span>{item === COLOR_PUNTUAL ? "Un color puntual" : item}</span>
                  </label>
                ))}
              </div>
              {campos.colorModo === COLOR_PUNTUAL && (
                <Field id={id("color-puntual")} label="Color" className="max-w-xs pt-1">
                  <Input
                    id={id("color-puntual")}
                    list={id("colores-lista")}
                    value={campos.colorPuntual}
                    onChange={(event) => cambiar("colorPuntual", event.target.value)}
                    autoComplete="off"
                  />
                  <datalist id={id("colores-lista")}>
                    {opciones.colores.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </Field>
              )}
              {errorDe("color") && (
                <p id={`${id("color")}-error`} className="text-xs font-medium text-danger">
                  {errorDe("color")}
                </p>
              )}
            </fieldset>

            <fieldset
              className="space-y-2"
              aria-describedby={errorDe("colores") ? `${id("colores")}-error` : undefined}
            >
              <legend className="text-[13px] font-medium">
                Curva de colores{" "}
                <span className="font-normal text-muted-foreground">· {campos.colores.length} elegidos</span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((item) => {
                  const activo = campos.colores.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => toggleColor(item)}
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
                        style={{ background: swatchFor(item) }}
                      />
                      {item}
                      {activo && <Check aria-hidden className="size-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex max-w-xs items-end gap-2 pt-1">
                <Field id={id("otro-color")} label="Otro color" className="flex-1">
                  <Input
                    id={id("otro-color")}
                    value={otroColor}
                    onChange={(event) => setOtroColor(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        agregarColor();
                      }
                    }}
                    autoComplete="off"
                  />
                </Field>
                <Button type="button" variant="outline" onClick={agregarColor} disabled={!otroColor.trim()}>
                  <Plus />
                  Agregar
                </Button>
              </div>
              {errorDe("colores") && (
                <p id={`${id("colores")}-error`} className="text-xs font-medium text-danger">
                  {errorDe("colores")}
                </p>
              )}
            </fieldset>

            {!esMedias && (
              <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                {atributosConLista.map(({ clave, label, opciones: lista }) => (
                  <Field key={clave} id={id(`atributo-${clave}`)} label={label}>
                    <NativeSelect
                      id={id(`atributo-${clave}`)}
                      value={campos.atributos[clave] ?? ""}
                      onChange={(event) => cambiar("atributos", { ...campos.atributos, [clave]: event.target.value })}
                    >
                      <option value="">Sin cargar</option>
                      {lista.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                ))}
                {atributosLibres.map(({ clave, label }) => (
                  <Field key={clave} id={id(`atributo-${clave}`)} label={label}>
                    <Input
                      id={id(`atributo-${clave}`)}
                      value={campos.atributos[clave] ?? ""}
                      onChange={(event) => cambiar("atributos", { ...campos.atributos, [clave]: event.target.value })}
                      autoComplete="off"
                    />
                  </Field>
                ))}
              </div>
            )}
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
          <CardContent className="space-y-5 pt-5">
            <Field
              id={id("costoDocena")}
              label="Costo de la docena"
              error={errorDe("costoDocena")}
              className="max-w-xs"
            >
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                >
                  $
                </span>
                <Input
                  id={id("costoDocena")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={100}
                  value={campos.costo}
                  onChange={(event) => cambiar("costo", event.target.value)}
                  placeholder="45000"
                  className="pl-7 tabular-nums"
                  {...invalid("costoDocena")}
                />
              </div>
            </Field>
            {rubroActual && (
              <div className="grid gap-3 sm:grid-cols-2">
                {OPCIONALES[familia].map(({ clave, label, hint }) => (
                  <div key={clave} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Label htmlFor={id(clave)}>{label}</Label>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                    <Switch
                      id={id(clave)}
                      checked={Boolean(campos.opcionales[clave])}
                      onCheckedChange={(valor) => cambiar("opcionales", { ...campos.opcionales, [clave]: valor })}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {rubroActual ? (
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
                  {presentaciones.map((item) => {
                    const seVende = item.listas.length > 0;
                    return (
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
                          {seVende ? `× ${formatNumber(item.coeficiente, { maximumFractionDigits: 4 })}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {seVende && costoDocena > 0 ? formatCurrency(item.precio) : "—"}
                        </td>
                        <td className="px-3 py-3 pr-5 text-xs text-muted-foreground">
                          {seVende ? item.listas.join(" · ") : "No se vende suelta: es el componente de sus packs"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
              Elegí el rubro para ver las presentaciones: lencería y medias llevan distintas.
            </p>
          )}
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
                    value={campos.medidas[index]}
                    onChange={(event) => {
                      const medidas = [...campos.medidas] as Campos["medidas"];
                      medidas[index] = event.target.value;
                      cambiar("medidas", medidas);
                    }}
                    className="tabular-nums"
                    {...(errorDe("medidasCm")
                      ? { "aria-invalid": true, "aria-describedby": `${id("medidasCm")}-error` }
                      : {})}
                  />
                </Field>
              ))}
              <Field id={id("pesoBultoKg")} label="Peso (kg)" error={errorDe("pesoBultoKg")}>
                <Input
                  id={id("pesoBultoKg")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={campos.peso}
                  onChange={(event) => cambiar("peso", event.target.value)}
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

        <AltaFotos
          fotos={campos.fotos}
          mediaUrl={opciones.mediaUrl}
          puedeEditar={puedeEditar}
          alCambiar={(cambio) => setCampos((actuales) => ({ ...actuales, fotos: cambio(actuales.fotos) }))}
        />
      </div>

      <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start" aria-label="Resumen del alta">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Así va a quedar</CardTitle>
              <CardDescription>Nombre según la regla RN-127, con la cantidad de cada presentación</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-2">
              <p className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed wrap-anywhere">
                {nombre || "Completá la prenda para ver el nombre"}
              </p>
              {nombre && rubroActual && (
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
                  Está completo
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

            {!real && (
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
            )}

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
            ) : puedeEditar ? (
              <div className="flex flex-col gap-2">
                {real ? (
                  <Button onClick={revisarSinPublicar}>
                    <CircleCheck />
                    Revisar si está completo
                  </Button>
                ) : (
                  <Button onClick={publicar} disabled={publicando}>
                    {publicando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Upload />}
                    {publicando ? "Publicando…" : "Publicar en DUX y Tienda Nube"}
                  </Button>
                )}
                <Button variant="outline" onClick={guardar} disabled={publicando || guardando}>
                  {guardando ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save />}
                  {guardando ? "Guardando…" : borradorId ? "Guardar los cambios" : "Guardar borrador"}
                </Button>
                <p className="text-xs text-muted-foreground" role="status">
                  {guardadoA && `Guardado a las ${formatTime(guardadoA)}. `}
                  {real && "Publicar en DUX y Tienda Nube todavía no está habilitado."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Tu rol puede ver el alta, pero no cargar productos.</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
