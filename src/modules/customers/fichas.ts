import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { VENTA_VALIDA } from "@/modules/inventory/ventas";
import { unirFichas, type ClientaUnida } from "./ficha-unica";

const dia = (fecha: Date | null) => fecha?.toISOString().slice(0, 10) ?? null;
const huella = (clienta: ClientaUnida) => createHash("sha256").update(JSON.stringify(clienta)).digest("hex");

export type ResultadoDeFichas = {
  clientas: number;
  nuevas: number;
  cambiadas: number;
  quitadas: number;
  sinTelefono: number;
};

/**
 * Arma la ficha única desde el espejo, así que fuera de producción ya está anonimizada.
 * Repetirlo no cambia nada: el ID de cada clienta se conserva. Si una clienta se queda
 * sin fichas, porque DUX le cambió el teléfono, se quita.
 */
export async function recalcularClientas(ahora: Date): Promise<ResultadoDeFichas> {
  const db = getDb();
  const [fichas, compras, existentes] = await Promise.all([
    db.duxCustomer.findMany({
      select: {
        duxId: true,
        name: true,
        firstName: true,
        phone: true,
        normalizedPhone: true,
        email: true,
        province: true,
        city: true,
        createdOn: true,
      },
    }),
    db.duxInvoice.groupBy({
      by: ["customerDuxId"],
      where: { ...VENTA_VALIDA, customerDuxId: { not: null } },
      _max: { issuedOn: true },
    }),
    db.customer.findMany({ select: { id: true, normalizedPhone: true, contentHash: true } }),
  ]);

  const ultimaCompra = new Map(compras.map(({ customerDuxId, _max }) => [customerDuxId, dia(_max.issuedOn)]));
  const { clientas, sinTelefono } = unirFichas(
    fichas.map(({ createdOn, ...ficha }) => ({
      ...ficha,
      creadaEl: dia(createdOn),
      ultimaCompra: ultimaCompra.get(ficha.duxId) ?? null,
    })),
  );

  const previas = new Map(existentes.map((fila) => [fila.normalizedPhone, fila]));
  const filas = clientas.map((clienta) => ({ ...clienta, contentHash: huella(clienta) }));
  const nuevas = filas.filter(({ normalizedPhone }) => !previas.has(normalizedPhone));
  const cambiadas = filas.filter((fila) => {
    const previa = previas.get(fila.normalizedPhone);
    return previa !== undefined && previa.contentHash !== fila.contentHash;
  });
  const vigentes = new Set(filas.map(({ normalizedPhone }) => normalizedPhone));
  const quitadas = existentes.filter(({ normalizedPhone }) => !vigentes.has(normalizedPhone)).map(({ id }) => id);

  await db.$transaction([
    db.customer.createMany({
      data: nuevas.map((fila) => ({ id: newId(), ...fila, firstSeenAt: ahora, changedAt: ahora })),
    }),
    ...cambiadas.map((fila) =>
      db.customer.update({
        where: { normalizedPhone: fila.normalizedPhone },
        data: { ...fila, changedAt: ahora },
      }),
    ),
    db.customer.deleteMany({ where: { id: { in: quitadas } } }),
  ]);

  return {
    clientas: filas.length,
    nuevas: nuevas.length,
    cambiadas: cambiadas.length,
    quitadas: quitadas.length,
    sinTelefono,
  };
}
