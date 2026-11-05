import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/db/client";
import { newId } from "@/db/ids";
import { serverEnv } from "@/env";
import { AppError } from "@/lib/errors";
import type { ErpClienta } from "@/modules/inventory/erp-gateway";
import { anonimizarClienta, hayQueAnonimizar } from "./anonimizar";
import { telefonoNormalizado } from "./telefono";

/** La huella se saca de lo que se guarda: ni ella deja rastro del dato real fuera de producción. */
function aFila(clienta: ErpClienta) {
  return {
    duxId: clienta.id,
    name: clienta.nombre,
    firstName: clienta.nombrePila,
    phone: clienta.telefono,
    normalizedPhone: telefonoNormalizado(clienta.telefono),
    email: clienta.email,
    province: clienta.provincia,
    city: clienta.localidad,
    enabled: clienta.habilitada,
    createdOn: clienta.creadaEl ? new Date(`${clienta.creadaEl}T00:00:00Z`) : null,
    contentHash: createHash("sha256").update(JSON.stringify(clienta)).digest("hex"),
  };
}

function paraEsteAmbiente(clientas: ErpClienta[]): ErpClienta[] {
  if (!hayQueAnonimizar()) return clientas;
  const clave = serverEnv().CREDENTIALS_KEY;
  // Sin clave no se puede anonimizar: antes que guardar un dato real, falla.
  if (!clave) throw new AppError("INTERNAL", "Falta CREDENTIALS_KEY: no se pueden anonimizar las clientas.");
  return clientas.map((clienta) => anonimizarClienta(clienta, clave));
}

export type ResultadoDeClientas = { nuevas: number; cambiadas: number; sinCambios: number };

export async function guardarClientas(clientas: ErpClienta[], ahora: Date): Promise<ResultadoDeClientas> {
  const db = getDb();
  const porId = new Map(paraEsteAmbiente(clientas).map((clienta) => [clienta.id, aFila(clienta)]));
  const existentes = await db.duxCustomer.findMany({
    where: { duxId: { in: [...porId.keys()] } },
    select: { duxId: true, contentHash: true },
  });
  const previas = new Map(existentes.map((fila) => [fila.duxId, fila.contentHash]));

  const filas = [...porId.values()];
  const nuevas = filas.filter(({ duxId }) => !previas.has(duxId));
  const cambiadas = filas.filter(({ duxId, contentHash }) => previas.has(duxId) && previas.get(duxId) !== contentHash);

  await db.$transaction([
    db.duxCustomer.createMany({
      data: nuevas.map((fila) => ({ id: newId(), ...fila, firstSeenAt: ahora, changedAt: ahora })),
    }),
    ...cambiadas.map((fila) =>
      db.duxCustomer.update({ where: { duxId: fila.duxId }, data: { ...fila, changedAt: ahora } }),
    ),
  ]);

  return {
    nuevas: nuevas.length,
    cambiadas: cambiadas.length,
    sinCambios: filas.length - nuevas.length - cambiadas.length,
  };
}
