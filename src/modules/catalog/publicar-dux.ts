import "server-only";
import { duxEscritura, erpGateway, sucursalesDux } from "@/integrations/dux";
import { getDb } from "@/db/client";
import { mediaUrl } from "@/integrations/blob";
import { serverEnv } from "@/env";
import type { Prisma } from "@/generated/prisma/client";
import type { CatalogoAltaInput, CatalogoBorrador, CatalogoPasoDeDux } from "@/lib/api/contracts/catalogo";
import { ConflictError, isAppError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { soltarBloqueo, tomarBloqueo } from "@/modules/platform/sync-runs";
import {
  aBorrador,
  codigosConocidos,
  escrituraEnDux,
  guardarCodigosUsados,
  subrubrosDeLasReferencias,
} from "./alta-consultas";
import {
  hojasDeImportacion,
  mismoNombre,
  pedidosDeDux,
  presentacionesDe,
  type ArchivoDeImportacion,
  type HojaDeImportacion,
  type IdsDeDux,
} from "./publicar";
import { agregarAlCatalogo } from "./edicion";
import { erroresDeAlta } from "./reglas-alta";

/**
 * Publicar un producto en DUX, de a un código. El estado queda en el borrador después de cada
 * uno: si se corta, se retoma por donde iba. DUX no borra ni cambia códigos, así que antes de
 * crear uno siempre se lo busca: un corte justo después de crearlo no lo duplica.
 */

const VENCE_EL_PASO_MS = 2 * 60 * 1000;
const bloqueoDe = (id: string) => `alta:${id}`;

const leerBorrador = async (id: string) => {
  const borrador = await getDb().catalogDraft.findUnique({ where: { id } });
  if (!borrador) throw new NotFoundError("Ese borrador ya no está.");
  return borrador;
};

const pasosDe = (steps: Prisma.JsonValue | null): CatalogoPasoDeDux[] | null =>
  (steps as CatalogoPasoDeDux[] | null) ?? null;

const pasosIniciales = (input: CatalogoAltaInput): CatalogoPasoDeDux[] =>
  presentacionesDe(input).map(({ codigo, nombre }) => ({ codigo, nombre, estado: "pendiente", detalle: null }));

/** Con todos sus códigos en DUX, el producto entra al catálogo: aparece con la próxima sincronización. */
const guardarPasos = async (id: string, pasos: CatalogoPasoDeDux[], input: CatalogoAltaInput) => {
  const enDux = pasos.every(({ estado }) => estado === "creado");
  if (enDux) await agregarAlCatalogo(input);
  return getDb().catalogDraft.update({
    where: { id },
    data: {
      steps: pasos as unknown as Prisma.InputJsonArray,
      duxDoneAt: enDux ? new Date() : null,
      updatedAt: new Date(),
    },
  });
};

/** Lo mismo que muestra el formulario. `conUsados`: un código ya creado en un intento anterior no cuenta. */
async function validar(input: CatalogoAltaInput, { conUsados }: { conUsados: boolean }) {
  const errores = erroresDeAlta(input, [], {
    codigosUsados: conUsados ? await codigosConocidos() : [],
    subrubrosDeDux: await subrubrosDeLasReferencias(),
  });
  if (errores.length > 0) throw new ValidationError(errores[0]!.mensaje);
}

async function idsDeDux(input: CatalogoAltaInput): Promise<IdsDeDux> {
  const db = getDb();
  const referencias = await db.duxReference.findMany();
  const buscar = (kind: string, name: string, parentId?: number) =>
    referencias.find(
      (fila) => fila.kind === kind && fila.name === name && (parentId === undefined || fila.parentId === parentId),
    );
  const rubro = buscar("rubro", input.rubro);
  const subrubro = rubro && buscar("subrubro", input.subrubro, rubro.duxId);
  if (!rubro || !subrubro) throw new ConflictError(`${input.rubro} › ${input.subrubro} ya no está en DUX.`);

  const proveedor = referencias.find((fila) => fila.kind === "proveedor" && String(fila.duxId) === input.proveedorId);
  if (!proveedor) throw new ConflictError("Ese proveedor ya no está en DUX.");

  let marca: string | null = null;
  if (input.marca) {
    const conCodigo = await db.duxItem.findFirst({
      where: { brand: input.marca, brandCode: { not: null } },
      select: { brandCode: true },
    });
    if (!conCodigo?.brandCode) throw new ConflictError(`Falta el código de la marca ${input.marca}: sincronizá DUX.`);
    marca = conCodigo.brandCode;
  }

  const { DUX_ID_PERSONAL: personal, DUX_ID_UNIDAD_MEDIDA: unidadDeMedida } = serverEnv();
  if (!personal || !unidadDeMedida) throw new ConflictError(escrituraEnDux().motivo ?? "Falta configuración de DUX.");

  return {
    rubro: rubro.duxId,
    subrubro: subrubro.duxId,
    proveedor: proveedor.duxId,
    marca,
    listas: listasDe(referencias),
    personal,
    unidadDeMedida,
    sucursales: sucursalesDux(),
  };
}

const listasDe = (referencias: readonly { kind: string; name: string; duxId: number }[]) =>
  Object.fromEntries(referencias.filter(({ kind }) => kind === "lista").map(({ name, duxId }) => [name, duxId]));

export type AvanceEnDux = {
  borrador: CatalogoBorrador;
  /** El código que se creó en este paso, para dejarlo en la auditoría. */
  creado: { codigo: string; nombre: string; precio: number } | null;
};

/** Hace un paso: crea el próximo código que falta. Si ya no falta ninguno, no toca DUX. */
export async function avanzarEnDux(id: string): Promise<AvanceEnDux> {
  const candado = await tomarBloqueo(bloqueoDe(id), VENCE_EL_PASO_MS);
  if (!candado) throw new ConflictError("Este producto ya se está publicando.");
  try {
    return await unPaso(id);
  } finally {
    await soltarBloqueo(bloqueoDe(id), candado);
  }
}

async function unPaso(id: string): Promise<AvanceEnDux> {
  // Primero el candado por ambiente: fuera de producción no se llega a marcar nada.
  const { puede, motivo } = escrituraEnDux();
  if (!puede) throw new ConflictError(motivo ?? "Este ambiente no escribe en DUX.");
  const escritura = await duxEscritura();

  const fila = await leerBorrador(id);
  const input = fila.data as unknown as CatalogoAltaInput;
  const previos = pasosDe(fila.steps);
  if (!previos) await validar(input, { conUsados: true });
  const pasos = previos ?? pasosIniciales(input);

  const paso = pasos.find(({ estado }) => estado !== "creado");
  if (!paso) return { borrador: aBorrador(await guardarPasos(id, pasos, input)), creado: null };

  const ids = await idsDeDux(input);
  const principal = input.fotos[0];
  const pedido = pedidosDeDux(input, ids, principal ? mediaUrl(principal.clave) : null).find(
    ({ cod_item }) => cod_item === paso.codigo,
  );
  if (!pedido) throw new ConflictError(`${paso.codigo} ya no sale de los datos del borrador.`);

  let creado: AvanceEnDux["creado"] = null;
  try {
    const existente = await (await erpGateway()).buscarItem(paso.codigo);
    if (existente && !mismoNombre(existente.nombre, paso.nombre)) {
      paso.estado = "error";
      paso.detalle = `Ya existe en DUX con otro nombre: ${existente.nombre}.`;
    } else if (existente) {
      paso.estado = "creado";
      paso.detalle = "Ya estaba en DUX.";
    } else {
      await escritura.crearItem(pedido);
      paso.estado = "creado";
      paso.detalle = null;
      creado = { codigo: paso.codigo, nombre: paso.nombre, precio: pedido.precios[0]?.valor ?? 0 };
    }
  } catch (error) {
    if (!isAppError(error)) throw error;
    logger.warn({ codigo: paso.codigo, code: error.code }, "alta en DUX: falló un código");
    paso.estado = "error";
    paso.detalle = error.message;
  }

  if (paso.estado === "creado") await guardarCodigosUsados([paso.codigo], new Date());
  return { borrador: aBorrador(await guardarPasos(id, pasos, input)), creado };
}

/** Después de importar los `.xls` a mano: mira qué códigos ya están. Solo lee de DUX. */
export async function comprobarEnDux(id: string): Promise<CatalogoBorrador> {
  const fila = await leerBorrador(id);
  const input = fila.data as unknown as CatalogoAltaInput;
  const pasos = pasosDe(fila.steps) ?? pasosIniciales(input);
  const gateway = await erpGateway();

  for (const paso of pasos) {
    if (paso.estado === "creado") continue;
    const existente = await gateway.buscarItem(paso.codigo);
    if (!existente) {
      paso.estado = "pendiente";
      paso.detalle = "Todavía no está en DUX.";
    } else if (mismoNombre(existente.nombre, paso.nombre)) {
      paso.estado = "creado";
      paso.detalle = "Importado a mano.";
      await guardarCodigosUsados([paso.codigo], new Date());
    } else {
      paso.estado = "error";
      paso.detalle = `Ya existe en DUX con otro nombre: ${existente.nombre}.`;
    }
  }
  return aBorrador(await guardarPasos(id, pasos, input));
}

/** El plan B: lo mismo que iría por la API, en el formato que DUX importa. */
export async function hojaDeImportacion(id: string, archivo: ArchivoDeImportacion): Promise<HojaDeImportacion> {
  const { data } = await leerBorrador(id);
  const input = data as unknown as CatalogoAltaInput;
  await validar(input, { conUsados: false });

  const referencias = await getDb().duxReference.findMany();
  const proveedor = referencias.find((fila) => fila.kind === "proveedor" && String(fila.duxId) === input.proveedorId);
  if (!proveedor) throw new ConflictError("Ese proveedor ya no está en DUX.");
  return hojasDeImportacion(input, { proveedor: proveedor.name, listas: listasDe(referencias) })[archivo];
}
