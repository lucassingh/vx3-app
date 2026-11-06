import "server-only";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";

/**
 * El corte (`solucion_doc/06` §6.2): hasta acá, el Sheet y Drive mandan y el catálogo se regenera
 * desde ellos; desde acá, se edita solo en la app. Las copias crudas pasan a ser la fuente: el
 * armado sigue siendo uno solo, y sigue leyendo DUX. Se puede volver atrás: el Sheet queda intacto.
 */

const DECISION_DE_CORTE = "corte";
const CLAVE = "catalogo";

export type EstadoDelCorte = { cortadoEl: string; por: string } | null;

export async function estadoDelCorte(): Promise<EstadoDelCorte> {
  const fila = await getDb().catalogDecision.findUnique({
    where: { type_key: { type: DECISION_DE_CORTE, key: CLAVE } },
  });
  return fila ? { cortadoEl: fila.decidedAt.toISOString(), por: fila.decidedByLabel } : null;
}

export async function marcarElCorte(quien: string, ahora = new Date()): Promise<void> {
  await getDb().catalogDecision.upsert({
    where: { type_key: { type: DECISION_DE_CORTE, key: CLAVE } },
    create: {
      id: newId(),
      type: DECISION_DE_CORTE,
      key: CLAVE,
      value: {},
      decidedByLabel: quien,
      decidedAt: ahora,
    },
    update: {},
  });
}

/** La próxima importación vuelve a leer el Sheet: lo que se editó ahí desde la app se pisa. */
export async function deshacerElCorte(): Promise<void> {
  await getDb().catalogDecision.deleteMany({ where: { type: DECISION_DE_CORTE, key: CLAVE } });
}
