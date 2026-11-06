import { CircleAlert, Warehouse } from "lucide-react";
import Link from "next/link";
import { FichaDialog } from "@/components/clientas/ficha-dialog";
import { param, type SearchParams } from "@/components/clientas/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncWidget } from "@/components/views/async-widget";
import { SkeletonText } from "@/components/views/skeletons";
import { toQueryString } from "@/lib/api/http";
import { api } from "@/lib/api/server";
import type { CatalogoFaltante, CatalogoFicha } from "@/lib/api/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { VigenciaBadge } from "./catalogo-widgets";
import { FotoDeProducto } from "./foto-de-producto";

function Atributo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Seccion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** "Sin cargar" se puede completar; "No hay dato" es definitivo (RN-124); sin ninguno de los dos, no corresponde. */
function DatoDelSheet({
  valor,
  dato,
  faltantes,
}: {
  valor: string | null;
  dato: string;
  faltantes: CatalogoFaltante[];
}) {
  if (valor) return valor;
  const faltante = faltantes.find((item) => item.dato === dato);
  const texto = !faltante ? "No aplica" : faltante.situacion === "no_hay_dato" ? "No hay dato" : "Sin cargar";
  return <span className="text-muted-foreground">{texto}</span>;
}

function ProductoContent({ producto }: { producto: CatalogoFicha }) {
  const { faltantes, bulto, medidasCm, pesoKg } = producto;
  const aCorregir = faltantes.filter(({ situacion }) => situacion === "falta");
  const sinDato = faltantes.filter(({ situacion }) => situacion === "no_hay_dato");

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {producto.sku}
          </Badge>
          <VigenciaBadge producto={producto} />
          <Badge variant="neutral">
            Prioridad {producto.prioridad}
            {producto.ranking && ` · puesto ${formatNumber(producto.ranking)}`}
          </Badge>
        </div>
        <DialogTitle className="text-balance">{producto.nombre}</DialogTitle>
        <DialogDescription>
          {[producto.rubro, producto.subrubro].filter(Boolean).join(" · ") || "Sin rubro"}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-5">
        <Seccion title="Fotos">
          {producto.fotos.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2">
              {producto.fotos.map((foto) => (
                <li key={foto.id}>
                  <a
                    href={foto.original}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={foto.nombre}
                    className="block overflow-hidden rounded-lg border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <FotoDeProducto
                      url={foto.miniatura}
                      sku={producto.sku}
                      colores={producto.colores}
                      className="rounded-none"
                    />
                    <span className="sr-only">Abrir {foto.nombre} (pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3">
              <FotoDeProducto
                url={producto.foto}
                sku={producto.sku}
                colores={producto.colores}
                tamano="lg"
                className="w-28"
              />
              <p className="text-sm text-muted-foreground">
                {producto.foto ? "No tiene fotos en Drive: esta es la de DUX." : "No tiene fotos en Drive ni en DUX."}
              </p>
            </div>
          )}
        </Seccion>

        <Seccion title="Venta">
          <dl className="divide-y divide-border">
            <Atributo label="Bulto">
              {bulto ? (
                <>
                  <span className="font-medium tabular-nums">{formatCurrency(bulto.precio)}</span>{" "}
                  <span className="text-muted-foreground">
                    · {bulto.label} ({bulto.codigo})
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Sin bulto en DUX</span>
              )}
            </Atributo>
            <Atributo label="Disponible">
              {formatNumber(producto.bultosDisponibles)} {producto.bultosDisponibles === 1 ? "bulto" : "bultos"}
            </Atributo>
            <Atributo label="Última venta">
              {producto.ultimaVenta ? (
                formatDate(producto.ultimaVenta, { day: "numeric", month: "short", year: "numeric" })
              ) : (
                <span className="text-muted-foreground">Sin ventas en el último año</span>
              )}
            </Atributo>
          </dl>
        </Seccion>

        <Seccion title="Atributos">
          <dl className="divide-y divide-border">
            <Atributo label="Marca">
              <DatoDelSheet valor={producto.marca} dato="Marca" faltantes={faltantes} />
            </Atributo>
            <Atributo label="Último proveedor">
              <DatoDelSheet valor={producto.proveedor} dato="Proveedor" faltantes={faltantes} />
            </Atributo>
            <Atributo label="Tela">
              <DatoDelSheet valor={producto.tela} dato="Tela" faltantes={faltantes} />
            </Atributo>
            <Atributo label="Colores">
              {producto.coloresTexto ?? <span className="text-muted-foreground">Sin cargar</span>}
            </Atributo>
            <Atributo label="Talles">
              {producto.talles ?? <span className="text-muted-foreground">Sin cargar</span>}
            </Atributo>
            {producto.atributos.map(({ label, valor }) => (
              <Atributo key={label} label={label}>
                {valor}
              </Atributo>
            ))}
            <Atributo label="Medidas y peso">
              {medidasCm || pesoKg ? (
                <span className="tabular-nums">
                  {medidasCm ? `${medidasCm.join(" × ")} cm` : "Sin medidas"} ·{" "}
                  {pesoKg ? `${formatNumber(pesoKg)} kg` : "sin peso"}
                </span>
              ) : (
                <span className="text-muted-foreground">Sin cargar</span>
              )}
            </Atributo>
          </dl>
        </Seccion>

        <Seccion title="Presentaciones">
          <ul className="divide-y divide-border rounded-lg border border-border">
            {producto.presentaciones.map((item) => (
              <li key={item.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <span className="w-24 font-mono text-xs">{item.codigo}</span>
                <span className="min-w-0 flex-1">
                  {item.label}
                  {item.esBulto && (
                    <Badge variant="primary" className="ml-2">
                      Bulto mayorista
                    </Badge>
                  )}
                  {!item.enDux && (
                    <Badge variant="warning" className="ml-2">
                      No está en DUX
                    </Badge>
                  )}
                </span>
                <span className="font-medium tabular-nums">{item.precio > 0 ? formatCurrency(item.precio) : "—"}</span>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion title="Qué le falta">
          {faltantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tiene todos los datos.</p>
          ) : (
            <ul className="space-y-1.5">
              {aCorregir.map(({ dato, seCorrigeEn, bloquea }) => (
                <li key={dato} className="flex items-start gap-2 text-sm">
                  <CircleAlert
                    aria-hidden
                    className={
                      bloquea ? "mt-0.5 size-4 shrink-0 text-warning" : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                    }
                  />
                  <span>
                    {dato}
                    {bloquea && <span className="text-warning"> (no se puede vender sin esto)</span>}
                    <span className="block text-xs text-muted-foreground">Se corrige en: {seCorrigeEn}</span>
                  </span>
                </li>
              ))}
              {sinDato.length > 0 && (
                <li className="text-xs text-muted-foreground">
                  No hay dato, y no va a haber: {sinDato.map(({ dato }) => dato.toLowerCase()).join(", ")}.
                </li>
              )}
            </ul>
          )}
        </Seccion>

        <Seccion title="De dónde sale">
          <ul className="flex flex-wrap gap-2 text-xs">
            <li>
              <Badge variant={producto.enSheet ? "success" : "warning"}>
                {producto.enSheet ? `Sheet, fila ${producto.filaDelSheet}` : "No está en el Sheet"}
              </Badge>
            </li>
            <li>
              <Badge variant={producto.enDux ? "success" : "warning"}>
                {producto.enDux ? "DUX" : "No está en DUX"}
              </Badge>
            </li>
            <li>
              <Badge variant={producto.fotos.length > 0 ? "success" : "warning"}>
                {producto.fotos.length > 0
                  ? `Drive, ${producto.fotos.length} ${producto.fotos.length === 1 ? "foto" : "fotos"}`
                  : "Sin fotos en Drive"}
              </Badge>
            </li>
          </ul>
        </Seccion>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" asChild>
          <Link href={`/stock/espejo${toQueryString({ q: producto.sku })}`}>
            <Warehouse />
            Ver stock
          </Link>
        </Button>
      </DialogFooter>
    </>
  );
}

async function ProductoLoader({ sku }: { sku: string }) {
  return <ProductoContent producto={await api.catalogo.producto(sku)} />;
}

function ProductoSkeleton() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">Ficha del producto</DialogTitle>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-5 w-full" />
      </DialogHeader>
      <DialogBody className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
        <SkeletonText lines={6} />
      </DialogBody>
    </>
  );
}

/** Abre la ficha si la URL trae `?producto=`: se puede compartir el link, y al cerrarla vuelve a la misma lista. */
export async function ProductoFromParams({
  searchParams,
  basePath,
}: {
  searchParams: Promise<SearchParams>;
  basePath: string;
}) {
  const params = await searchParams;
  const sku = param(params, "producto");
  if (!sku) return null;

  const actuales = Object.fromEntries(Object.keys(params).map((nombre) => [nombre, param(params, nombre)]));
  const closeHref = `${basePath}${toQueryString({ ...actuales, producto: undefined })}`;

  return (
    <FichaDialog key={sku} closeHref={closeHref}>
      <AsyncWidget title="la ficha del producto" className="m-5" fallback={<ProductoSkeleton />}>
        <ProductoLoader sku={sku} />
      </AsyncWidget>
    </FichaDialog>
  );
}
