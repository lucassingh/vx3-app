import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { soltarBloqueo, tomarBloqueo } from "@/modules/platform/sync-runs";
import { normalizarCodigo } from "./codigos";
import { armarDesdeLasCopias, BLOQUEO_DEL_CATALOGO, DECISION_DE_FOTO, DECISION_DE_HISTORICO } from "./importar";

/**
 * Lo que el Sheet no puede guardar (`solucion_doc/06` §6.2, decisión 4 de la 1.8): a qué producto
 * va una foto, si se descarta, y los históricos. Vive con la llave natural, así sobrevive a
 * cualquier importación, y cada corrida la vuelve a aplicar. Lo demás se corrige en la fuente.
 */

/** Alcanza para rearmar: el armado no lee Google. */
const VENCE_REARMADO_MS = 2 * 60_000;

export type Quien = { id: string; label: string };

/**
 * Para que la cola y el catálogo cambien enseguida. Si hay una importación en curso, la decisión ya
 * está guardada y esa corrida o la siguiente la aplica.
 */
async function aplicarDecisiones(): Promise<boolean> {
  const bloqueo = await tomarBloqueo(BLOQUEO_DEL_CATALOGO, VENCE_REARMADO_MS);
  if (!bloqueo) {
    logger.info("catálogo: decisión guardada con una importación en curso");
    return false;
  }
  try {
    await armarDesdeLasCopias(new Date());
    return true;
  } finally {
    await soltarBloqueo(BLOQUEO_DEL_CATALOGO, bloqueo);
  }
}

function guardar(type: string, key: string, value: Prisma.InputJsonValue, quien: Quien) {
  const decision = { value, decidedById: quien.id, decidedByLabel: quien.label, decidedAt: new Date() };
  return getDb().catalogDecision.upsert({
    where: { type_key: { type, key } },
    create: { id: newId(), type, key, ...decision },
    update: decision,
  });
}

/** `producto` null: se descarta. */
export async function decidirFoto(driveId: string, producto: string | null, quien: Quien) {
  const db = getDb();
  const archivo = await db.catalogDriveFile.findUnique({ where: { driveId }, select: { name: true } });
  if (!archivo) throw new NotFoundError("Esa foto ya no está en Drive.");

  const codigo = producto === null ? null : normalizarCodigo(producto);
  if (codigo !== null) {
    const existe = await db.catalogProduct.count({ where: { baseCode: codigo, present: true } });
    if (!existe) throw new NotFoundError(`No existe el producto ${codigo}.`);
  }
  await guardar(DECISION_DE_FOTO, driveId, { producto: codigo }, quien);
  return { archivo: archivo.name, producto: codigo, aplicada: await aplicarDecisiones() };
}

/** Queda agotado: se sigue viendo en el catálogo. */
export async function marcarNoHistorico(producto: string, quien: Quien) {
  const codigo = normalizarCodigo(producto);
  const existe = await getDb().catalogProduct.count({ where: { baseCode: codigo, present: true } });
  if (!existe) throw new NotFoundError(`No existe el producto ${codigo}.`);
  await guardar(DECISION_DE_HISTORICO, codigo, { confirmado: false }, quien);
  return { producto: codigo, aplicada: await aplicarDecisiones() };
}

/** Lo que está en la cola en este momento: un producto que cae después se confirma aparte. */
export async function confirmarHistoricosPendientes(quien: Quien) {
  const db = getDb();
  const pendientes = await db.catalogReviewCase.findMany({ where: { block: "historicos" }, select: { key: true } });
  const decidedAt = new Date();
  await db.catalogDecision.createMany({
    data: pendientes.map(({ key }) => ({
      id: newId(),
      type: DECISION_DE_HISTORICO,
      key,
      value: { confirmado: true },
      decidedById: quien.id,
      decidedByLabel: quien.label,
      decidedAt,
    })),
    skipDuplicates: true,
  });
  return { confirmados: pendientes.length, aplicada: await aplicarDecisiones() };
}

export async function deshacerDecision(tipo: string, clave: string) {
  const { count } = await getDb().catalogDecision.deleteMany({ where: { type: tipo, key: clave } });
  if (count === 0) throw new NotFoundError("Esa decisión ya no está.");
  return { aplicada: await aplicarDecisiones() };
}

/** Vuelven a la cola, para confirmarlos de nuevo. */
export async function deshacerHistoricosConfirmados() {
  const { count } = await getDb().catalogDecision.deleteMany({
    where: { type: DECISION_DE_HISTORICO, value: { path: ["confirmado"], equals: true } },
  });
  return { deshechos: count, aplicada: await aplicarDecisiones() };
}
