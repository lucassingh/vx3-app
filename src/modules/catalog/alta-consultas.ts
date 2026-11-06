import "server-only";
import { baseDelStore, borrarDelStore } from "@/integrations/blob";
import { destinoDeEscritura } from "@/integrations/dux/escritura";
import { destinoDeLaTienda } from "@/integrations/tiendanube/client";
import { serverEnv } from "@/env";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { Prisma } from "@/generated/prisma/client";
import type {
  CatalogoAltaInput,
  CatalogoAltaOpciones,
  CatalogoBorrador,
  CatalogoEscrituraEnDux,
  CatalogoEstadoEnLaTienda,
  CatalogoPasoDeDux,
} from "@/lib/api/contracts/catalogo";
import { ConflictError, isAppError, NotFoundError } from "@/lib/errors";
import { normalizeText } from "@/lib/utils";
import type { ErpReferencias } from "@/modules/inventory/erp-gateway";
import { prefijoDeCodigo, prefijoDelSubrubro, proximoCodigo } from "./alta";
import { esMedias, normalizarCodigo } from "./codigos";
import { ATRIBUTOS } from "./consultas";
import { coloresDe } from "./filtros";

/** Solo agrega: un código no deja de haber existido porque DUX deje de mandarlo. Devuelve cuántos son nuevos. */
export async function guardarCodigosUsados(codigos: readonly string[], ahora: Date): Promise<number> {
  const { count } = await getDb().duxUsedCode.createMany({
    data: codigos.map((code) => ({ code, normalizedCode: normalizarCodigo(code), firstSeenAt: ahora })),
    skipDuplicates: true,
  });
  return count;
}

/** Se reemplazan enteras: lo que DUX ya no manda deja de ofrecerse. */
export async function guardarReferencias(
  { rubros, subrubros, proveedores, listas }: ErpReferencias,
  ahora: Date,
): Promise<number> {
  const data = [
    ...rubros.map(({ id, nombre }) => ({ kind: "rubro", duxId: id, parentId: 0, name: nombre, enabled: true })),
    ...subrubros.map(({ id, rubroId, nombre }) => ({
      kind: "subrubro",
      duxId: id,
      parentId: rubroId,
      name: nombre,
      enabled: true,
    })),
    ...proveedores.map(({ id, nombre, habilitado }) => ({
      kind: "proveedor",
      duxId: id,
      parentId: 0,
      name: nombre,
      enabled: habilitado,
    })),
    ...listas.map(({ id, nombre, habilitado }) => ({
      kind: "lista",
      duxId: id,
      parentId: 0,
      name: nombre,
      enabled: habilitado,
    })),
  ].map((fila) => ({ ...fila, readAt: ahora }));
  await getDb().$transaction(async (tx) => {
    await tx.duxReference.deleteMany();
    await tx.duxReference.createMany({ data, skipDuplicates: true });
  });
  return data.length;
}

/** Hay códigos en un solo lado: lo inhabilitado está en `/v2/stock`, y lo vendido que ya no existe, en los comprobantes. */
export async function codigosConocidos(donde: Prisma.StringFilter = {}): Promise<string[]> {
  const db = getDb();
  const [items, usados, vendidos] = await Promise.all([
    db.duxItem.findMany({ where: { normalizedCode: donde }, select: { normalizedCode: true } }),
    db.duxUsedCode.findMany({ where: { normalizedCode: donde }, select: { normalizedCode: true } }),
    db.duxInvoiceItem.findMany({ where: { baseCode: donde }, select: { baseCode: true }, distinct: ["baseCode"] }),
  ]);
  return [
    ...new Set([
      ...items.map(({ normalizedCode }) => normalizedCode),
      ...usados.map(({ normalizedCode }) => normalizedCode),
      ...vendidos.map(({ baseCode }) => baseCode),
    ]),
  ];
}

const leerPrendas = async () =>
  (
    await getDb().duxItem.findMany({
      where: { kind: "prenda", category: { not: null }, subcategory: { not: null } },
      select: { baseCode: true, category: true, subcategory: true },
    })
  ).map(({ baseCode, category, subcategory }) => ({ rubro: category, subrubro: subcategory, codigo: baseCode }));

/** Null si el subrubro no tiene prefijo: lo define VX3, y la app no lo inventa. */
export async function codigoSugerido(
  rubro: string,
  subrubro: string,
): Promise<{ prefijo: string; codigo: string } | null> {
  const prefijo = prefijoDelSubrubro(rubro, subrubro, await leerPrendas());
  if (!prefijo) return null;
  return { prefijo, codigo: proximoCodigo(prefijo, await codigosConocidos({ startsWith: prefijo })) };
}

/** Si este ambiente puede escribir, y si no, por qué. No toca DUX. */
export function escrituraEnDux(): CatalogoEscrituraEnDux {
  const { DUX_ID_UNIDAD_MEDIDA, DUX_ID_PERSONAL, DUX_CABECERA_DE_PRUEBA } = serverEnv();
  try {
    destinoDeEscritura(process.env.APP_ENV, DUX_CABECERA_DE_PRUEBA);
  } catch (error) {
    if (isAppError(error)) return { puede: false, motivo: error.message };
    throw error;
  }
  if (!DUX_ID_UNIDAD_MEDIDA || !DUX_ID_PERSONAL) {
    return {
      puede: false,
      motivo: "Falta confirmar con DUX la unidad de medida y quién figura como responsable de la carga.",
    };
  }
  return { puede: true, motivo: null };
}

/** Fuera de producción se arma el pedido y se muestra, sin mandarlo. */
export function escrituraEnLaTienda(): CatalogoEscrituraEnDux {
  try {
    destinoDeLaTienda(process.env.APP_ENV);
  } catch (error) {
    if (isAppError(error)) return { puede: false, motivo: error.message };
    throw error;
  }
  if (!serverEnv().TIENDANUBE_STORE_ID) return { puede: false, motivo: "Falta TIENDANUBE_STORE_ID en este ambiente." };
  return { puede: true, motivo: null };
}

/** No son mercadería, o no se dan de alta desde acá (RN-98). */
const RUBROS_SIN_ALTA = new Set(["COMBOS", "CONSUMIDOR FINAL", "ENVIOS", "ENVIOS Y EMBALAJE", "PRUEBAS"]);

/** Elástico y otros detalles son texto libre: tienen casi tantos valores como productos. */
const ATRIBUTOS_SIN_LISTA = new Set(["elastico", "otros_detalles"]);

/** "NO" está cargado en el Sheet como copa, y en el nombre diría "COPA NO". Es "No corresponde". */
const NO_ES_UNA_OPCION: Record<string, Set<string>> = { copa: new Set(["NO"]) };

const MINIMO_DE_USOS = { color: 10, atributo: 2 };

/** Los errores de tipeo más usados del Sheet: no se ofrecen como un color más. */
const COLOR_MAL_ESCRITO: Record<string, string> = { NEGRA: "NEGRO", BIEGE: "BEIGE", FUXIA: "FUCSIA", ROSADO: "ROSA" };
const NO_ES_UN_COLOR = new Set(["ETC"]);

/** Une lo que se escribe distinto, con la forma más usada, y los más usados primero. */
function masUsados(valores: readonly (string | null | undefined)[], minimo = 1): string[] {
  const grupos = new Map<string, { total: number; formas: Map<string, number> }>();
  for (const valor of valores) {
    const limpio = valor?.trim();
    if (!limpio) continue;
    const clave = normalizeText(limpio);
    const grupo = grupos.get(clave) ?? { total: 0, formas: new Map<string, number>() };
    grupo.total += 1;
    grupo.formas.set(limpio, (grupo.formas.get(limpio) ?? 0) + 1);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()]
    .filter(({ total }) => total >= minimo)
    .toSorted((a, b) => b.total - a.total)
    .map(({ formas }) => [...formas].toSorted((a, b) => b[1] - a[1])[0]![0]);
}

const limpiarColor = (color: string) => {
  const limpio = color.replace(/[.\s]+$/, "");
  return COLOR_MAL_ESCRITO[limpio] ?? limpio;
};

export async function opcionesDeAlta(): Promise<CatalogoAltaOpciones> {
  const db = getDb();
  const [referencias, prendas, productos, marcas, conProductos, codigos] = await Promise.all([
    db.duxReference.findMany({ where: { enabled: true }, orderBy: { name: "asc" } }),
    leerPrendas(),
    db.catalogProduct.findMany({
      where: { present: true },
      select: { fabric: true, colors: true, attributes: true },
    }),
    db.duxItem.findMany({
      where: { present: true, brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
    }),
    db.duxItem.findMany({
      where: { present: true, supplierId: { not: null } },
      select: { supplierId: true },
      distinct: ["supplierId"],
    }),
    codigosConocidos(),
  ]);
  const de = (kind: string) => referencias.filter((referencia) => referencia.kind === kind);
  const subrubros = de("subrubro");
  // Un código de pack cuenta por su número: viajan solo los de base, que son la tercera parte.
  const usados = [...new Set(codigos.map((codigo) => normalizarCodigo(codigo).split("-")[0]!))];
  const porPrefijo = new Map<string, string[]>();
  for (const codigo of usados) {
    const prefijo = prefijoDeCodigo(codigo);
    if (!prefijo) continue;
    const lista = porPrefijo.get(prefijo);
    if (lista) lista.push(codigo);
    else porPrefijo.set(prefijo, [codigo]);
  }

  return {
    rubros: de("rubro")
      .filter(({ name }) => !RUBROS_SIN_ALTA.has(name.toUpperCase()))
      .map(({ duxId, name }) => ({
        rubro: name,
        familia: esMedias(name) ? ("medias" as const) : ("lenceria" as const),
        subrubros: subrubros
          .filter(({ parentId }) => parentId === duxId)
          .map((subrubro) => {
            const prefijo = prefijoDelSubrubro(name, subrubro.name, prendas);
            return {
              nombre: subrubro.name,
              prefijo,
              proximoSku: prefijo ? proximoCodigo(prefijo, porPrefijo.get(prefijo) ?? []) : null,
            };
          }),
      }))
      .filter(({ subrubros: lista }) => lista.length > 0),
    marcas: marcas.flatMap(({ brand }) => (brand ? [brand] : [])).toSorted((a, b) => a.localeCompare(b, "es")),
    proveedores: de("proveedor").map(({ duxId, name }) => ({
      id: String(duxId),
      nombre: name,
      conProductos: conProductos.some(({ supplierId }) => supplierId === duxId),
    })),
    telas: masUsados(productos.map(({ fabric }) => fabric)),
    colores: masUsados(
      productos
        .flatMap(({ colors }) => coloresDe(colors).map(limpiarColor))
        .filter((color) => !NO_ES_UN_COLOR.has(color)),
      MINIMO_DE_USOS.color,
    ),
    atributos: Object.entries(ATRIBUTOS).map(([clave, label]) => ({
      clave,
      label,
      opciones: ATRIBUTOS_SIN_LISTA.has(clave)
        ? []
        : masUsados(
            productos.map(({ attributes }) => (attributes as Record<string, string>)[clave]),
            MINIMO_DE_USOS.atributo,
          ).filter((opcion) => !NO_ES_UNA_OPCION[clave]?.has(opcion)),
    })),
    codigosUsados: usados,
    mediaUrl: baseDelStore(),
    escrituraEnDux: escrituraEnDux(),
    escrituraEnLaTienda: escrituraEnLaTienda(),
  };
}

/* ---- Borradores ----------------------------------------------------------- */

export const aBorrador = (fila: {
  id: string;
  data: Prisma.JsonValue;
  createdByLabel: string;
  updatedAt: Date;
  steps: Prisma.JsonValue | null;
  duxDoneAt: Date | null;
  storeState: Prisma.JsonValue | null;
}): CatalogoBorrador => ({
  id: fila.id,
  input: fila.data as CatalogoAltaInput,
  quien: fila.createdByLabel,
  cuando: fila.updatedAt.toISOString(),
  publicacion: fila.steps ? { pasos: fila.steps as CatalogoPasoDeDux[], enDux: fila.duxDoneAt !== null } : null,
  tienda: (fila.storeState as CatalogoEstadoEnLaTienda | null) ?? null,
});

/** Con un código creado en DUX, lo que se está publicando ya no se puede cambiar: DUX no borra ni renombra por API. */
const yaHayCodigosEnDux = (steps: Prisma.JsonValue | null) =>
  ((steps as CatalogoPasoDeDux[] | null) ?? []).some(({ estado }) => estado === "creado");

/** Los subrubros de DUX, para validar sin depender de lo que mande el navegador. */
export async function subrubrosDeLasReferencias() {
  const referencias = await getDb().duxReference.findMany({ where: { kind: { in: ["rubro", "subrubro"] } } });
  const rubros = new Map(referencias.filter(({ kind }) => kind === "rubro").map(({ duxId, name }) => [duxId, name]));
  return referencias.flatMap(({ kind, parentId, name }) => {
    const rubro = kind === "subrubro" ? rubros.get(parentId) : undefined;
    return rubro ? [{ rubro, subrubro: name }] : [];
  });
}

export async function listarBorradores(): Promise<CatalogoBorrador[]> {
  const filas = await getDb().catalogDraft.findMany({ orderBy: { updatedAt: "desc" } });
  return filas.map(aBorrador);
}

/** Sin `id`, crea uno. Un borrador no se valida: está para guardar lo que todavía no está completo. */
export async function guardarBorrador(
  id: string | null,
  input: CatalogoAltaInput,
  quien: { id: string; label: string },
): Promise<CatalogoBorrador> {
  const db = getDb();
  const ahora = new Date();
  const data = input as unknown as Prisma.InputJsonObject;
  if (id) {
    const previo = await db.catalogDraft.findUnique({ where: { id }, select: { data: true, steps: true } });
    if (!previo) throw new NotFoundError("Ese borrador ya no está.");
    if (yaHayCodigosEnDux(previo.steps)) {
      throw new ConflictError("Ya hay códigos creados en DUX: este producto no se puede cambiar desde el borrador.");
    }
    // Si DUX lo rechazó antes de crear nada, se corrige y se vuelve a empezar.
    const guardado = await db.catalogDraft.update({
      where: { id },
      data: { data, updatedAt: ahora, steps: Prisma.DbNull, duxDoneAt: null },
    });
    const quedan = new Set(input.fotos.map(({ clave }) => clave));
    await borrarFotosSinUso(fotosDelBorrador(previo.data).filter((clave) => !quedan.has(clave)));
    return aBorrador(guardado);
  }
  return aBorrador(
    await db.catalogDraft.create({
      data: {
        id: newId(),
        data,
        createdById: quien.id,
        createdByLabel: quien.label,
        createdAt: ahora,
        updatedAt: ahora,
      },
    }),
  );
}

export async function borrarBorrador(id: string): Promise<void> {
  const db = getDb();
  const previo = await db.catalogDraft.findUnique({ where: { id }, select: { data: true, steps: true } });
  if (!previo) throw new NotFoundError("Ese borrador ya no está.");
  if (yaHayCodigosEnDux(previo.steps)) {
    throw new ConflictError("Ya hay códigos creados en DUX: este borrador no se puede borrar.");
  }
  await db.catalogDraft.delete({ where: { id } });
  await borrarFotosSinUso(fotosDelBorrador(previo.data));
}

/* ---- Fotos subidas ---------------------------------------------------------- */

const fotosDelBorrador = (data: Prisma.JsonValue): string[] =>
  ((data as { fotos?: { clave: string }[] } | null)?.fotos ?? []).map(({ clave }) => clave);

/**
 * Del store se va solo lo que nadie usa: ni un producto, ni un borrador. La lista puede venir del
 * navegador, así que esto es lo que evita borrar una foto en uso.
 */
export async function borrarFotosSinUso(claves: readonly string[]): Promise<void> {
  if (claves.length === 0) return;
  const db = getDb();
  const enProductos = await db.catalogPhoto.findMany({
    where: { storageKey: { in: [...claves] } },
    select: { storageKey: true },
  });
  const usadas = new Set(enProductos.map(({ storageKey }) => storageKey));
  const libres: string[] = [];
  for (const clave of claves) {
    if (usadas.has(clave)) continue;
    const enBorrador = await db.catalogDraft.findFirst({
      where: { data: { path: ["fotos"], array_contains: [{ clave }] } },
      select: { id: true },
    });
    if (!enBorrador) libres.push(clave);
  }
  await borrarDelStore(libres);
}
