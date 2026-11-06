import "server-only";
import { getDb } from "@/db/client";
import { normalizarCodigo } from "./codigos";
import { prefijoDelSubrubro, proximoCodigo } from "./alta";

/** Solo agrega: un código no deja de haber existido porque DUX deje de mandarlo. Devuelve cuántos son nuevos. */
export async function guardarCodigosUsados(codigos: readonly string[], ahora: Date): Promise<number> {
  const { count } = await getDb().duxUsedCode.createMany({
    data: codigos.map((code) => ({ code, normalizedCode: normalizarCodigo(code), firstSeenAt: ahora })),
    skipDuplicates: true,
  });
  return count;
}

/** Null si el subrubro no tiene prefijo: lo define VX3, y la app no lo inventa. */
export async function codigoSugerido(
  rubro: string,
  subrubro: string,
): Promise<{ prefijo: string; codigo: string } | null> {
  const db = getDb();
  const prendas = await db.duxItem.findMany({
    where: { kind: "prenda", category: { not: null }, subcategory: { not: null } },
    select: { baseCode: true, category: true, subcategory: true },
  });
  const prefijo = prefijoDelSubrubro(
    rubro,
    subrubro,
    prendas.map(({ baseCode, category, subcategory }) => ({
      rubro: category,
      subrubro: subcategory,
      codigo: baseCode,
    })),
  );
  if (!prefijo) return null;

  // Hay códigos en un solo lado: lo inhabilitado está en /v2/stock, y lo vendido que ya no existe, en los comprobantes.
  const delPrefijo = { startsWith: prefijo };
  const [items, usados, vendidos] = await Promise.all([
    db.duxItem.findMany({ where: { normalizedCode: delPrefijo }, select: { normalizedCode: true } }),
    db.duxUsedCode.findMany({ where: { normalizedCode: delPrefijo }, select: { normalizedCode: true } }),
    db.duxInvoiceItem.findMany({
      where: { baseCode: delPrefijo },
      select: { baseCode: true },
      distinct: ["baseCode"],
    }),
  ]);
  return {
    prefijo,
    codigo: proximoCodigo(prefijo, [
      ...items.map(({ normalizedCode }) => normalizedCode),
      ...usados.map(({ normalizedCode }) => normalizedCode),
      ...vendidos.map(({ baseCode }) => baseCode),
    ]),
  };
}
