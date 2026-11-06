import "server-only";
import { cache } from "react";
import { getDb } from "@/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { urlDeMiniatura } from "@/integrations/google/client";
import type {
  CatalogoFacetas,
  CatalogoFaltante,
  CatalogoFicha,
  CatalogoFila,
  CatalogoQuery,
  RevisionCaso,
  RevisionDecision,
  RevisionResumen,
} from "@/lib/api/contracts/catalogo";
import type { Kpi, Paginated } from "@/lib/api/types";
import { normalizarCodigo } from "./codigos";
import { coloresDe, facetasDe, pasaLosFiltros, type ProductoFiltrable } from "./filtros";
import { DECISION_DE_FOTO, DECISION_DE_HISTORICO } from "./importar";
import { BLOQUES } from "./revision";
import { etiquetaDePresentacion, LISTA_DEL_BULTO, type DatoQueFalta, type Faltante } from "./salud";

/**
 * Lo que muestra el catálogo, leído de Postgres con el mismo contrato de la maqueta. Precio y
 * stock no se copian: salen del espejo de DUX, por el código.
 */

const POR_PAGINA = 24;
const ANCHO_EN_LA_FICHA = 800;

/** Dónde se corrige cada dato hasta el pase (`solucion_doc/06` §6.2). */
const FALTANTE: Record<DatoQueFalta, { dato: string; bloquea: boolean; fuente: "Sheet" | "DUX" | "Drive" }> = {
  nombre: { dato: "Nombre", bloquea: true, fuente: "DUX" },
  precio: { dato: "Precio del bulto", bloquea: true, fuente: "DUX" },
  costo: { dato: "Costo", bloquea: true, fuente: "DUX" },
  envio: { dato: "Peso y medidas", bloquea: true, fuente: "Sheet" },
  foto: { dato: "Foto", bloquea: true, fuente: "Drive" },
  sheet: { dato: "Fila en el Sheet", bloquea: false, fuente: "Sheet" },
  tela: { dato: "Tela", bloquea: false, fuente: "Sheet" },
  marca: { dato: "Marca", bloquea: false, fuente: "Sheet" },
  proveedor: { dato: "Proveedor", bloquea: false, fuente: "Sheet" },
};

const enDrive = (driveId: string) => `https://drive.google.com/file/d/${driveId}/view`;

const ATRIBUTOS: Record<string, string> = {
  copa: "Copa",
  encaje: "Encaje",
  push_up: "Push up",
  aro: "Aro",
  elastico: "Elástico",
  tipo_bretel: "Bretel",
  gancho_espalda: "Gancho",
  otros_detalles: "Otros detalles",
};

const COLUMNAS = {
  id: true,
  baseCode: true,
  name: true,
  isCombo: true,
  category: true,
  subcategory: true,
  brand: true,
  lastSupplier: true,
  fabric: true,
  colors: true,
  sizes: true,
  lifecycle: true,
  seasonal: true,
  priority: true,
  bulkCode: true,
  missing: true,
  readyToSell: true,
  sheetRow: true,
  searchText: true,
} satisfies Prisma.CatalogProductSelect;

type FilaDeLaBase = Prisma.CatalogProductGetPayload<{ select: typeof COLUMNAS }>;

/** Los más vendidos primero. Una vez por request: los indicadores, las facetas y la lista salen de lo mismo. */
const leerProductos = cache(() =>
  getDb().catalogProduct.findMany({
    where: { present: true },
    select: COLUMNAS,
    orderBy: [{ salesRank: { sort: "asc", nulls: "last" } }, { baseCode: "asc" }],
  }),
);

const aFiltrable = (fila: FilaDeLaBase): ProductoFiltrable => ({
  rubro: fila.category,
  subrubro: fila.subcategory,
  marca: fila.brand,
  tela: fila.fabric,
  talle: fila.sizes,
  colores: coloresDe(fila.colors),
  proveedor: fila.lastSupplier,
  vigencia: fila.lifecycle,
  listo: fila.readyToSell,
  texto: fila.searchText,
});

type CodigoDelEspejo = {
  packQuantity: number | null;
  prices: unknown;
  stockAvailable: unknown;
  imageUrl: string | null;
};

async function leerEspejo(codigos: string[]): Promise<Map<string, CodigoDelEspejo>> {
  const filas = await getDb().duxItem.findMany({
    where: { present: true, normalizedCode: { in: codigos } },
    select: { normalizedCode: true, packQuantity: true, prices: true, stockAvailable: true, imageUrl: true },
  });
  return new Map(filas.map((fila) => [fila.normalizedCode, fila]));
}

const preciosDe = (item: CodigoDelEspejo | undefined) => (item?.prices ?? []) as { list: string; cents: number }[];

const precioMayorista = (item: CodigoDelEspejo | undefined) =>
  (preciosDe(item).find(({ list }) => list === LISTA_DEL_BULTO)?.cents ?? 0) / 100;

const disponibleEn = (item: CodigoDelEspejo | undefined) => Math.max(0, Number(item?.stockAvailable ?? 0));

/** Los bultos salen de las prendas (RN-09). Un combo tiene stock propio. */
function bultosDisponibles(fila: FilaDeLaBase, espejo: Map<string, CodigoDelEspejo>): number {
  const bulto = fila.bulkCode ? espejo.get(fila.bulkCode) : undefined;
  const prenda = espejo.get(fila.baseCode);
  if (!fila.isCombo && prenda && bulto?.packQuantity) {
    return Math.floor(disponibleEn(prenda) / bulto.packQuantity);
  }
  return Math.floor(disponibleEn(bulto));
}

function faltantesDe(fila: FilaDeLaBase): CatalogoFaltante[] {
  return (fila.missing as Faltante[]).map(({ dato, situacion }) => {
    const { fuente, ...resto } = FALTANTE[dato];
    return {
      ...resto,
      situacion,
      seCorrigeEn: fuente === "Sheet" && fila.sheetRow ? `Sheet, fila ${fila.sheetRow}` : fuente,
    };
  });
}

function aFila(fila: FilaDeLaBase, espejo: Map<string, CodigoDelEspejo>, foto: string | null): CatalogoFila {
  const bulto = fila.bulkCode ? espejo.get(fila.bulkCode) : undefined;
  return {
    sku: fila.baseCode,
    nombre: fila.name,
    rubro: fila.category,
    subrubro: fila.subcategory,
    marca: fila.brand,
    colores: coloresDe(fila.colors),
    vigencia: fila.lifecycle,
    deTemporada: fila.seasonal,
    prioridad: fila.priority,
    // Vale Drive; si no hay, la de DUX, de 400 px (`06` §6.2).
    foto: foto ?? bulto?.imageUrl ?? espejo.get(fila.baseCode)?.imageUrl ?? null,
    bulto: fila.bulkCode
      ? {
          codigo: fila.bulkCode,
          label: etiquetaDePresentacion(
            { tipo: fila.isCombo ? "combo" : "pack", cantidad: bulto?.packQuantity ?? null },
            fila.category,
          ),
          precio: precioMayorista(bulto),
        }
      : null,
    bultosDisponibles: bultosDisponibles(fila, espejo),
    listoParaVender: fila.readyToSell,
    faltantes: faltantesDe(fila),
  };
}

export async function kpisDelCatalogo(): Promise<Kpi[]> {
  const productos = await leerProductos();
  const de = (vigencia: FilaDeLaBase["lifecycle"]) => productos.filter(({ lifecycle }) => lifecycle === vigencia);
  const activos = de("activo");
  const agotados = de("agotado");
  const enLasTres = await getDb().catalogProduct.count({
    where: { present: true, inSheet: true, inDux: true, photos: { some: {} } },
  });
  return [
    {
      id: "productos",
      label: "Productos",
      value: productos.length,
      format: "number",
      hint: `${enLasTres.toLocaleString("es-AR")} en el Sheet, Drive y DUX`,
    },
    {
      id: "activos",
      label: "Activos",
      value: activos.length,
      format: "number",
      hint: `${activos.filter(({ readyToSell }) => readyToSell).length.toLocaleString("es-AR")} listos para vender`,
    },
    {
      id: "agotados",
      label: "Agotados",
      value: agotados.length,
      format: "number",
      hint: `${agotados.filter(({ seasonal }) => seasonal).length.toLocaleString("es-AR")} de temporada`,
    },
    {
      id: "historicos",
      label: "Históricos",
      value: de("historico").length,
      format: "number",
      hint: "Fuera del catálogo, pero se pueden buscar",
    },
  ];
}

export async function facetasDelCatalogo(query: CatalogoQuery): Promise<CatalogoFacetas> {
  return facetasDe((await leerProductos()).map(aFiltrable), query);
}

export async function listarProductos(
  query: CatalogoQuery & { page?: number; pageSize?: number },
): Promise<Paginated<CatalogoFila>> {
  const coinciden = (await leerProductos()).filter((fila) => pasaLosFiltros(aFiltrable(fila), query));
  const pageSize = query.pageSize ?? POR_PAGINA;
  const totalPages = Math.max(1, Math.ceil(coinciden.length / pageSize));
  const page = Math.min(query.page ?? 1, totalPages);
  const pagina = coinciden.slice((page - 1) * pageSize, page * pageSize);

  const [espejo, primeras] = await Promise.all([
    leerEspejo(pagina.flatMap(({ baseCode, bulkCode }) => (bulkCode ? [baseCode, bulkCode] : [baseCode]))),
    getDb().catalogPhoto.findMany({
      where: { position: 0, productId: { in: pagina.map(({ id }) => id) } },
      select: { productId: true, driveId: true },
    }),
  ]);
  const fotoDe = new Map(primeras.map(({ productId, driveId }) => [productId, urlDeMiniatura(driveId)]));

  return {
    data: pagina.map((fila) => aFila(fila, espejo, fotoDe.get(fila.id) ?? null)),
    page,
    pageSize,
    total: coinciden.length,
    totalPages,
  };
}

export async function fichaDelProducto(sku: string): Promise<CatalogoFicha | null> {
  const producto = await getDb().catalogProduct.findFirst({
    where: { baseCode: normalizarCodigo(sku), present: true },
    include: { presentations: { orderBy: { code: "asc" } }, photos: { orderBy: { position: "asc" } } },
  });
  if (!producto) return null;

  const espejo = await leerEspejo(producto.presentations.map(({ code }) => code));
  const [primera] = producto.photos;
  const fila = aFila(producto, espejo, primera ? urlDeMiniatura(primera.driveId) : null);
  const atributos = producto.attributes as Record<string, string>;
  const conMedidas = producto.lengthCm && producto.widthCm && producto.heightCm;

  return {
    ...fila,
    tela: producto.fabric,
    coloresTexto: producto.colors,
    talles: producto.sizes,
    proveedor: producto.lastSupplier,
    atributos: Object.entries(ATRIBUTOS).flatMap(([clave, label]) =>
      atributos[clave] ? [{ label, valor: atributos[clave] }] : [],
    ),
    medidasCm: conMedidas ? [Number(producto.lengthCm), Number(producto.widthCm), Number(producto.heightCm)] : null,
    pesoKg: producto.weightKg === null ? null : Number(producto.weightKg),
    ranking: producto.salesRank,
    ultimaVenta: producto.lastSaleOn?.toISOString().slice(0, 10) ?? null,
    enSheet: producto.inSheet,
    filaDelSheet: producto.sheetRow,
    enDux: producto.inDux,
    presentaciones: producto.presentations
      .map(({ code, kind, quantity, inDux }) => {
        const item = espejo.get(code);
        const conPrecio = preciosDe(item).filter(({ cents }) => cents > 0);
        return {
          codigo: code,
          label: etiquetaDePresentacion({ tipo: kind, cantidad: quantity }, producto.category),
          prendas: quantity,
          precio: precioMayorista(item) || (conPrecio[0]?.cents ?? 0) / 100,
          listas: conPrecio.map(({ list }) => list),
          esBulto: code === producto.bulkCode,
          disponible: Math.floor(disponibleEn(item)),
          enDux: inDux,
        };
      })
      .toSorted((a, b) => (a.prendas ?? 0) - (b.prendas ?? 0)),
    fotos: producto.photos.map(({ driveId, name, width, height }) => ({
      id: driveId,
      nombre: name,
      miniatura: urlDeMiniatura(driveId, ANCHO_EN_LA_FICHA),
      enDrive: enDrive(driveId),
      ancho: width,
      alto: height,
    })),
  };
}

/* ---- Cola de revisión ---------------------------------------------------- */

const FUENTE_DEL_CASO: Record<string, string> = { sheet: "Sheet", dux: "DUX", drive: "Drive", app: "En esta pantalla" };

export async function resumenDeRevision(): Promise<RevisionResumen> {
  const db = getDb();
  const [porBloque, ultima] = await Promise.all([
    db.catalogReviewCase.groupBy({ by: ["block"], _count: { _all: true } }),
    db.syncRun.findFirst({
      where: { integration: "google", operation: "catalogo", status: "ok" },
      orderBy: { startedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  const importado = ultima !== null || porBloque.length > 0;
  if (!importado) return { bloques: [], casos: 0, actualizadoEl: null };
  const cuantos = new Map(porBloque.map(({ block, _count }) => [block, _count._all]));
  const bloques = BLOQUES.map((bloque) => ({ ...bloque, casos: cuantos.get(bloque.id) ?? 0 }));
  return {
    bloques,
    casos: bloques.reduce((suma, { casos }) => suma + casos, 0),
    actualizadoEl: ultima?.finishedAt?.toISOString() ?? null,
  };
}

/** Los más vendidos primero: es lo que conviene corregir antes. */
export async function casosDeUnBloque({
  bloque,
  page,
  pageSize,
}: {
  bloque: string;
  page: number;
  pageSize: number;
}): Promise<Paginated<RevisionCaso>> {
  const db = getDb();
  const total = await db.catalogReviewCase.count({ where: { block: bloque } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const actual = Math.min(page, totalPages);
  const casos = await db.catalogReviewCase.findMany({
    where: { block: bloque },
    orderBy: [{ salesRank: { sort: "asc", nulls: "last" } }, { key: "asc" }],
    skip: (actual - 1) * pageSize,
    take: pageSize,
  });
  const codigos = casos.flatMap(({ baseCode }) => (baseCode ? [baseCode] : []));
  const nombres = new Map(
    (
      await db.catalogProduct.findMany({
        where: { baseCode: { in: codigos } },
        select: { baseCode: true, name: true },
      })
    ).map(({ baseCode, name }) => [baseCode, name]),
  );

  return {
    data: casos.map((caso) => {
      const detalles = caso.details as { nombre?: string; sugerencias?: string[] };
      const fuente = FUENTE_DEL_CASO[caso.fixIn] ?? caso.fixIn;
      return {
        id: caso.id,
        clave: caso.key,
        sku: caso.baseCode,
        nombre: caso.baseCode ? (nombres.get(caso.baseCode) ?? null) : null,
        prioridad: caso.priority,
        descripcion: caso.description,
        seCorrigeEn: caso.fixIn === "sheet" && caso.sheetRow ? `Sheet, fila ${caso.sheetRow}` : fuente,
        foto:
          caso.block === "fotos_sueltas"
            ? {
                nombre: detalles.nombre ?? caso.key,
                miniatura: urlDeMiniatura(caso.key),
                enDrive: enDrive(caso.key),
                sugerencias: detalles.sugerencias ?? [],
              }
            : null,
      };
    }),
    page: actual,
    pageSize,
    total,
    totalPages,
  };
}

export async function decisionesDeRevision(): Promise<RevisionDecision[]> {
  const db = getDb();
  const decisiones = await db.catalogDecision.findMany({
    where: { type: { in: [DECISION_DE_FOTO, DECISION_DE_HISTORICO] } },
    orderBy: { decidedAt: "desc" },
  });
  const archivos = new Map(
    (
      await db.catalogDriveFile.findMany({
        where: { driveId: { in: decisiones.filter(({ type }) => type === DECISION_DE_FOTO).map(({ key }) => key) } },
        select: { driveId: true, name: true },
      })
    ).map(({ driveId, name }) => [driveId, name]),
  );

  const confirmados = decisiones.filter(
    ({ type, value }) => type === DECISION_DE_HISTORICO && (value as { confirmado: boolean }).confirmado,
  );
  const [ultima] = confirmados;
  const enBloque: RevisionDecision[] = ultima
    ? [
        {
          tipo: "historico",
          clave: null,
          descripcion:
            confirmados.length === 1
              ? "1 histórico confirmado"
              : `${confirmados.length.toLocaleString("es-AR")} históricos confirmados`,
          quien: ultima.decidedByLabel,
          cuando: ultima.decidedAt.toISOString(),
        },
      ]
    : [];

  return [
    ...enBloque,
    ...decisiones
      .filter((decision) => !confirmados.includes(decision))
      .map(({ type, key, value, decidedByLabel, decidedAt }): RevisionDecision => {
        const producto = (value as { producto?: string | null }).producto;
        const archivo = archivos.get(key) ?? key;
        return {
          tipo: type === DECISION_DE_FOTO ? "foto" : "historico",
          clave: key,
          descripcion:
            type === DECISION_DE_HISTORICO
              ? `${key} no es histórico`
              : producto
                ? `${archivo} va en ${producto}`
                : `${archivo} quedó descartada`,
          quien: decidedByLabel,
          cuando: decidedAt.toISOString(),
        };
      }),
  ];
}
