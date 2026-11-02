import type { CatalogoAltaInput } from "@/lib/api/types";

/**
 * Reglas del alta de producto. Las bloqueantes son las de RN-98 y RN-84; marca
 * o proveedor desconocidos y pesos dudosos solo avisan. Las usan el formulario
 * y la API (la API vuelve a validar: nunca se confía en el navegador).
 */

export type AltaProblema = { campo: keyof CatalogoAltaInput | "fotos"; mensaje: string };

/** Peso razonable de un bulto, en kg (la auditoría encontró pesos cargados en gramos). */
export const PESO_MIN_KG = 0.03;
export const PESO_MAX_KG = 5;
export const MEDIDA_MAX_CM = 150;

export function erroresDeAlta(input: Partial<CatalogoAltaInput>, skusExistentes: string[]): AltaProblema[] {
  const errores: AltaProblema[] = [];
  const sku = (input.sku ?? "").trim().toUpperCase();

  if (!sku) errores.push({ campo: "sku", mensaje: "Falta el SKU." });
  else if (sku.startsWith("COMBO")) errores.push({ campo: "sku", mensaje: "Un SKU de alta no puede empezar con COMBO." });
  else if (sku.includes("DOCENA")) errores.push({ campo: "sku", mensaje: "El SKU no puede contener “DOCENA”." });
  else if (/-(3|6|12|24)$/.test(sku)) errores.push({ campo: "sku", mensaje: "El SKU base no puede terminar en -3, -6, -12 ni -24: se confunde con un pack." });
  else if (skusExistentes.includes(sku)) errores.push({ campo: "sku", mensaje: `${sku} ya existe en DUX. Si es el mismo producto con otros colores, usá el reciclado de SKU.` });

  if (!input.rubro || !input.subrubro) errores.push({ campo: "subrubro", mensaje: "Elegí el rubro y el subrubro (tienen que existir en DUX)." });
  if (!(input.nombre ?? "").trim()) errores.push({ campo: "nombre", mensaje: "Falta el nombre del producto." });
  if (!input.costoDocena || input.costoDocena <= 0) errores.push({ campo: "costoDocena", mensaje: "El costo de la docena tiene que ser mayor a $ 0." });
  if (!(input.colores ?? []).length) errores.push({ campo: "colores", mensaje: "Cargá al menos un color de la curva." });
  if (!(input.talles ?? "").trim()) errores.push({ campo: "talles", mensaje: "Falta la curva de talles." });

  const peso = input.pesoBultoKg ?? 0;
  if (!peso || peso <= 0) errores.push({ campo: "pesoBultoKg", mensaje: "El peso del bulto es obligatorio para cotizar el envío." });
  else if (peso > 20) errores.push({ campo: "pesoBultoKg", mensaje: `${peso} kg parece estar en gramos: ¿quisiste decir ${(peso / 1000).toLocaleString("es-AR")} kg?` });

  const medidas = input.medidasCm ?? [0, 0, 0];
  if (medidas.some((medida) => !medida || medida <= 0)) errores.push({ campo: "medidasCm", mensaje: "Largo, ancho y alto son obligatorios (con metro)." });
  else if (medidas.some((medida) => medida > MEDIDA_MAX_CM)) errores.push({ campo: "medidasCm", mensaje: `Ninguna medida puede pasar los ${MEDIDA_MAX_CM} cm (límite del Correo).` });

  return errores;
}

export function avisosDeAlta(input: Partial<CatalogoAltaInput>, marcas: string[]): AltaProblema[] {
  const avisos: AltaProblema[] = [];
  const peso = input.pesoBultoKg ?? 0;
  if (peso > 0 && peso <= 20 && (peso < PESO_MIN_KG || peso > PESO_MAX_KG)) {
    avisos.push({ campo: "pesoBultoKg", mensaje: `${peso} kg está fuera de lo habitual para un bulto (${PESO_MIN_KG} a ${PESO_MAX_KG} kg). Revisalo con la balanza.` });
  }
  if (input.marca && !marcas.includes(input.marca)) {
    avisos.push({ campo: "marca", mensaje: `“${input.marca}” no existe en DUX: hay que crearla primero allá, escrita igual (la API no crea marcas).` });
  }
  if (!input.marca) avisos.push({ campo: "marca", mensaje: "Sin marca: el producto queda incompleto para el bot." });
  if (!input.tela) avisos.push({ campo: "tela", mensaje: "Sin tela: el bot no va a poder filtrar por tela." });
  return avisos;
}

/** Nombre según RN-05: rubro + marca + detalle + aclaración + curva. La terminación del pack la agrega el sistema. */
export function nombreGenerado(parts: { base: string; marca: string; detalle: string; aclaracion: string; talles: string }) {
  const head = [parts.base, parts.marca, parts.detalle].map((part) => part.trim()).filter(Boolean).join(" ");
  return [head, parts.aclaracion.trim(), parts.talles.trim() && `curva de talles ${parts.talles.trim()}`]
    .filter(Boolean)
    .join(" - ")
    .toUpperCase();
}
