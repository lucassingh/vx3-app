import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { Prisma } from "@/generated/prisma/client";
import { fuentesDelCatalogo, googleClient } from "@/integrations/google";
import type { ArchivoDeDrive } from "@/integrations/google/client";
import { businessTime } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { normalizeText } from "@/lib/utils";
import { armarCatalogo, type FilaDelSheet, type ItemDeDux, type ProductoArmado } from "./armar";
import { leerPestana } from "./fuentes";
import { casosDeRevision } from "./revision";
import {
  DIAS_DE_VENTAS,
  DIAS_DEL_ANIO,
  evaluarCatalogo,
  LISTA_DEL_BULTO,
  type CodigoDelEspejo,
  type EvaluacionDelProducto,
  type VentaDelProducto,
} from "./salud";

/**
 * Importación repetible (`solucion_doc/06` §6.2): primero una copia cruda de cada fuente, y
 * después el catálogo armado desde esas copias y el espejo de DUX. Una lectura que falla no
 * toca nada del catálogo, y el catálogo se escribe en una sola transacción.
 *
 * Es descartable hasta el pase: lo único que no se puede perder son las decisiones, que viven
 * en otra tabla y se vuelven a aplicar en cada corrida.
 */

const CARPETA_RAIZ = "Repositorio Fotos";

/** Son miles de filas: el límite de 5 s por defecto no alcanza, con la base del otro lado de la red. */
const TRANSACCION_LARGA = { timeout: 60_000, maxWait: 10_000 };

export const DECISION_DE_FOTO = "foto";
export const DECISION_DE_HISTORICO = "historico";

/** Es el mismo bloqueo para leer las fuentes y para rearmar: nunca hay dos escribiendo el catálogo. */
export const BLOQUEO_DEL_CATALOGO = "google";

export type Lectura =
  { ok: true; llamadas: number; registros: number } | { ok: false; llamadas: number; motivo: string };

type ClienteDeGoogle = Awaited<ReturnType<typeof googleClient>>;

/** Lo que falla de Google vuelve como resultado, con el motivo para el panel. */
async function leerDeGoogle(
  fuente: string,
  leer: (cliente: ClienteDeGoogle) => Promise<number | { motivo: string }>,
): Promise<Lectura> {
  let llamadas = 0;
  try {
    const resultado = await leer(await googleClient({ alIntentar: () => llamadas++ }));
    if (typeof resultado === "number") return { ok: true, llamadas, registros: resultado };
    logger.warn({ fuente, motivo: resultado.motivo }, "catálogo: la fuente no se pudo usar");
    return { ok: false, llamadas, motivo: resultado.motivo };
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ fuente, code: error.code }, "catálogo: falló la lectura");
    return { ok: false, llamadas, motivo: error.message };
  }
}

export function leerYCopiarSheet(): Promise<Lectura> {
  return leerDeGoogle("sheet", async (cliente) => {
    const lectura = leerPestana(await cliente.leerPlanilla(fuentesDelCatalogo().sheetId));
    if (!lectura.ok) return { motivo: lectura.motivo };
    await guardarCopiaDelSheet(lectura.filas, new Date());
    return lectura.filas.length;
  });
}

export function leerYCopiarDrive(): Promise<Lectura> {
  return leerDeGoogle("drive", async (cliente) => {
    const archivos = await cliente.leerCarpeta(fuentesDelCatalogo().carpetaId, CARPETA_RAIZ);
    if (archivos.length === 0) return { motivo: "La carpeta de fotos de Drive volvió vacía." };
    await guardarCopiaDeDrive(archivos, new Date());
    return archivos.length;
  });
}

async function guardarCopiaDelSheet(filas: FilaDelSheet[], leidoEl: Date) {
  await getDb().$transaction(async (tx) => {
    await tx.catalogSheetRow.deleteMany();
    await tx.catalogSheetRow.createMany({
      data: filas.map(({ fila, visto, crudo }) => ({
        id: newId(),
        rowNumber: fila,
        shown: visto,
        raw: crudo as Prisma.InputJsonObject,
        readAt: leidoEl,
      })),
    });
  }, TRANSACCION_LARGA);
}

async function guardarCopiaDeDrive(archivos: ArchivoDeDrive[], leidoEl: Date) {
  await getDb().$transaction(async (tx) => {
    await tx.catalogDriveFile.deleteMany();
    await tx.catalogDriveFile.createMany({
      data: archivos.map((archivo) => ({
        id: newId(),
        driveId: archivo.id,
        name: archivo.nombre,
        mimeType: archivo.mimeType,
        bytes: archivo.bytes === null ? null : BigInt(archivo.bytes),
        md5: archivo.md5,
        width: archivo.ancho,
        height: archivo.alto,
        folder: archivo.ruta,
        modifiedAt: archivo.modificado ? new Date(archivo.modificado) : null,
        readAt: leidoEl,
      })),
    });
  }, TRANSACCION_LARGA);
}

/** Lo vendido por producto en el último año. Una venta anterior es lo mismo que ninguna (RN-125). */
async function ventasDelAnio(hoy: string): Promise<Map<string, VentaDelProducto>> {
  const desde = (dias: number) => new Date(`${businessTime.addDays(hoy, -dias)}T00:00:00Z`);
  const filas = await getDb().$queryRaw<{ base: string; centavos90: number; ultima: Date }[]>`
    SELECT i.base_code AS base,
      COALESCE(
        SUM(i.quantity * i.unit_price_cents * (1 - i.discount_pct / 100))
          FILTER (WHERE f.issued_on >= ${desde(DIAS_DE_VENTAS)}),
        0
      )::float8 AS centavos90,
      MAX(f.issued_on) AS ultima
    FROM dux_invoice_items i
    JOIN dux_invoices f ON f.id = i.invoice_id
    WHERE f.cancelled = false AND f.type NOT LIKE '%NOTA_CREDITO%' AND f.issued_on >= ${desde(DIAS_DEL_ANIO)}
      AND i.kind <> 'no_producto'
    GROUP BY i.base_code`;
  return new Map(
    filas.map(({ base, centavos90, ultima }) => [
      base,
      { centavos90: Math.round(centavos90), ultimaVenta: ultima.toISOString().slice(0, 10) },
    ]),
  );
}

async function leerEspejo() {
  const filas = await getDb().duxItem.findMany({
    where: { present: true },
    select: {
      code: true,
      normalizedCode: true,
      kind: true,
      baseCode: true,
      packQuantity: true,
      name: true,
      category: true,
      subcategory: true,
      brand: true,
      supplier: true,
      createdOn: true,
      imageUrl: true,
      stockReal: true,
      costCents: true,
      prices: true,
    },
  });
  const items = filas.map((fila): ItemDeDux => ({
    codigo: fila.code,
    nombre: fila.name,
    tipo: fila.kind,
    base: fila.baseCode,
    cantidad: fila.packQuantity,
    rubro: fila.category,
    subrubro: fila.subcategory,
    marca: fila.brand,
    proveedor: fila.supplier,
    creadoEl: fila.createdOn.toISOString().slice(0, 10),
    tieneFoto: Boolean(fila.imageUrl),
  }));
  const espejo = new Map(
    filas.map((fila): [string, CodigoDelEspejo] => [
      fila.normalizedCode,
      {
        stock: Number(fila.stockReal),
        precioCentavos:
          (fila.prices as { list: string; cents: number }[]).find(({ list }) => list === LISTA_DEL_BULTO)?.cents ?? 0,
        costoCentavos: Number(fila.costCents),
      },
    ]),
  );
  return { items, espejo };
}

function aContenido(producto: ProductoArmado, evaluacion: EvaluacionDelProducto) {
  const { marca, proveedor, tela, presentaciones } = producto;
  return {
    baseCode: producto.codigo,
    name: producto.nombre,
    isCombo: producto.esCombo,
    category: producto.rubro,
    subcategory: producto.subrubro,
    brand: marca.valor,
    lastSupplier: proveedor.valor,
    fabric: tela.valor,
    colors: producto.colores,
    sizes: producto.talles,
    attributes: producto.atributos,
    lengthCm: producto.largoCm,
    widthCm: producto.anchoCm,
    heightCm: producto.altoCm,
    weightKg: producto.pesoKg,
    lifecycle: evaluacion.estado,
    seasonal: evaluacion.deTemporada,
    priority: evaluacion.prioridad,
    salesRank: evaluacion.ranking,
    bulkCode: evaluacion.codigoDelBulto,
    missing: evaluacion.faltantes,
    readyToSell: evaluacion.listoParaVender,
    inSheet: producto.enSheet,
    inDux: producto.enDux,
    sheetRow: producto.filaDelSheet,
    searchText: normalizeText(
      [
        producto.codigo,
        ...presentaciones.map(({ codigo }) => codigo),
        producto.nombre,
        marca.valor,
        proveedor.valor,
        tela.valor,
        producto.rubro,
        producto.subrubro,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

type AEscribir = {
  fila: Prisma.CatalogProductCreateManyInput & { id: string };
  presentaciones: ProductoArmado["presentaciones"];
  fotos: ProductoArmado["fotos"];
};

export type ResumenDeImportacion = {
  productos: number;
  enLasTres: number;
  nuevos: number;
  cambiados: number;
  yaNoEstan: number;
  paraRevisar: number;
};

/** Idempotente: lo que no cambió no se toca, ni su ID ni su fecha. */
export async function armarDesdeLasCopias(ahora: Date, hoy = businessTime.today()): Promise<ResumenDeImportacion> {
  const db = getDb();
  const [filasCrudas, archivosCrudos, decisiones, { items, espejo }, ventas, previos] = await Promise.all([
    db.catalogSheetRow.findMany({ orderBy: { rowNumber: "asc" } }),
    db.catalogDriveFile.findMany({ orderBy: { driveId: "asc" } }),
    db.catalogDecision.findMany({ where: { type: { in: [DECISION_DE_FOTO, DECISION_DE_HISTORICO] } } }),
    leerEspejo(),
    ventasDelAnio(hoy),
    db.catalogProduct.findMany({
      select: { id: true, baseCode: true, contentHash: true, present: true, firstSeenAt: true },
    }),
  ]);

  const deTipo = (tipo: string) => decisiones.filter(({ type }) => type === tipo);
  const historicos = deTipo(DECISION_DE_HISTORICO);
  const armado = armarCatalogo({
    filas: filasCrudas.map(({ rowNumber, shown, raw }) => ({
      fila: rowNumber,
      visto: shown as Record<string, string>,
      crudo: raw as Record<string, unknown>,
    })),
    items,
    archivos: archivosCrudos.map(({ driveId, name, mimeType, md5, width, height }) => ({
      driveId,
      nombre: name,
      mimeType,
      md5,
      ancho: width,
      alto: height,
    })),
    decisiones: {
      fotos: new Map(
        deTipo(DECISION_DE_FOTO).map(({ key, value }) => [key, (value as { producto: string | null }).producto]),
      ),
    },
  });
  const { productos } = armado;
  const evaluaciones = evaluarCatalogo({
    productos,
    ventas,
    espejo,
    hoy,
    noSonHistoricos: new Set(
      historicos.filter(({ value }) => !(value as { confirmado: boolean }).confirmado).map(({ key }) => key),
    ),
  });
  const casos = casosDeRevision({
    armado,
    evaluaciones,
    espejo,
    historicosDecididos: new Set(historicos.map(({ key }) => key)),
  });
  const previoDe = new Map(previos.map((previo) => [previo.baseCode, previo]));

  const nuevos: AEscribir[] = [];
  const cambiados: AEscribir[] = [];
  for (const producto of productos) {
    const evaluacion = evaluaciones.get(producto.codigo)!;
    const contenido = aContenido(producto, evaluacion);
    const { presentaciones, fotos, codigo } = producto;
    const { ventas90Centavos, ultimaVenta } = evaluacion;
    const huella = createHash("sha256")
      .update(JSON.stringify({ contenido, ventas90Centavos, ultimaVenta, presentaciones, fotos }))
      .digest("hex");
    const previo = previoDe.get(codigo);
    if (previo?.contentHash === huella && previo.present) continue;
    const fila = {
      ...contenido,
      id: previo?.id ?? newId(),
      sales90dCents: BigInt(ventas90Centavos),
      lastSaleOn: ultimaVenta ? new Date(`${ultimaVenta}T00:00:00Z`) : null,
      contentHash: huella,
      firstSeenAt: previo?.firstSeenAt ?? ahora,
      changedAt: ahora,
    };
    (previo ? cambiados : nuevos).push({ fila, presentaciones, fotos });
  }

  const vigentes = new Set(productos.map(({ codigo }) => codigo));
  const ausentes = previos.filter(({ baseCode, present }) => present && !vigentes.has(baseCode)).map(({ id }) => id);
  const aEscribir = [...nuevos, ...cambiados];

  await db.$transaction(async (tx) => {
    // Lo que se subió en la app no está en Drive, así que la importación no lo puede volver a traer.
    const subidasEnLaApp = await tx.catalogPhoto.findMany({
      where: { productId: { in: cambiados.map(({ fila }) => fila.id) }, storageKey: { not: null } },
    });
    // Sus presentaciones y fotos se van en cascada, y vuelven con la fila nueva, con el mismo ID.
    await tx.catalogProduct.deleteMany({ where: { id: { in: cambiados.map(({ fila }) => fila.id) } } });
    // Lo que dejó de existir no se borra, pero suelta sus códigos y sus fotos: los puede tomar otro producto.
    await tx.catalogPresentation.deleteMany({ where: { productId: { in: ausentes } } });
    await tx.catalogPhoto.deleteMany({ where: { productId: { in: ausentes }, driveId: { not: null } } });
    await tx.catalogProduct.updateMany({ where: { id: { in: ausentes } }, data: { present: false, changedAt: ahora } });

    await tx.catalogProduct.createMany({ data: aEscribir.map(({ fila }) => fila) });
    await tx.catalogPresentation.createMany({
      data: aEscribir.flatMap(({ fila, presentaciones }) =>
        presentaciones.map(({ codigo, tipo, cantidad, enDux }) => ({
          id: newId(),
          productId: fila.id,
          code: codigo,
          kind: tipo,
          quantity: cantidad,
          inDux: enDux,
        })),
      ),
      // Si el Sheet y DUX leen distinto un mismo código por el rubro, aparece en dos productos: queda uno,
      // y el rubro distinto va a la cola.
      skipDuplicates: true,
    });
    await tx.catalogPhoto.createMany({
      data: aEscribir.flatMap(({ fila, fotos }) =>
        fotos.map(({ driveId, nombre, posicion, ancho, alto }) => ({
          id: newId(),
          productId: fila.id,
          driveId,
          name: nombre,
          position: posicion,
          width: ancho,
          height: alto,
        })),
      ),
    });
    await tx.catalogPhoto.createMany({ data: subidasEnLaApp });

    // Se regenera entera: lo corregido en la fuente desaparece solo.
    await tx.catalogReviewCase.deleteMany();
    await tx.catalogReviewCase.createMany({ data: casos.map((caso) => ({ id: newId(), ...caso })) });
  }, TRANSACCION_LARGA);

  return {
    productos: productos.length,
    enLasTres: productos.filter(({ enSheet, enDux, fotos }) => enSheet && enDux && fotos.length > 0).length,
    nuevos: nuevos.length,
    cambiados: cambiados.length,
    yaNoEstan: ausentes.length,
    paraRevisar: casos.length,
  };
}
