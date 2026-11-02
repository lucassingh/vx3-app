/**
 * Catálogo semilla: SKUs, marcas, telas, curvas, proveedores y costos reales
 * del Excel "VX3 - Descripción productos". Stock y ventas son de ejemplo.
 * Los precios no se cargan: salen del motor de precios (RN-11 a RN-13).
 */

export type Familia = "lenceria" | "medias";

export type EstadoProducto = "borrador" | "listo" | "publicado" | "pausado";

export type ProductoSeed = {
  sku: string;
  /** Nombre según la regla RN-05, sin la terminación del pack (la agrega el sistema). */
  nombre: string;
  rubro: string;
  subrubro: string;
  marca: string | null;
  /** Define la estructura de packs (RN-01): lencería -6/-12, medias -12. */
  familia: Familia;
  tela: string | null;
  colores: string[];
  talles: string;
  /** Aclaración anti-reclamo (RN-06). */
  aclaracion: string;
  proveedorId: string;
  costoDocena: number;
  pesoBultoKg: number;
  /** Largo × ancho × alto del bulto, en cm. */
  medidasCm: [number, number, number];
  stockPrendas: number;
  /** Prendas reservadas por pedidos sin confirmar (ADR-11). */
  reservadoPrendas: number;
  ventas30dBultos: number;
  estado: EstadoProducto;
  /** Salud del producto (RF-M1-10): lo que le falta o está mal. */
  faltantes: string[];
  publicado: { dux: boolean; tiendaNube: boolean; meta: boolean };
};

const all = { dux: true, tiendaNube: true, meta: true };
const duxTn = { dux: true, tiendaNube: true, meta: false };

export const productos: ProductoSeed[] = [
  { sku: "CJATN14", nombre: "Conjunto armado tres piezas AmorArma con aro y push up", rubro: "Conjuntos", subrubro: "Armado tres piezas", marca: "AmorArma", familia: "lenceria", tela: "Microfibra con encaje", colores: ["Blanco", "Azul", "Rosa viejo", "Negro", "Bordó", "Beige"], talles: "90 a 105", aclaracion: "colores y diseños de la foto", proveedorId: "p-bethy", costoDocena: 45_000, pesoBultoKg: 1.45, medidasCm: [32, 18, 9], stockPrendas: 84, reservadoPrendas: 12, ventas30dBultos: 41, estado: "publicado", faltantes: [], publicado: all },
  { sku: "CJATN31", nombre: "Conjunto armado tres piezas Condeza con detalles de encaje", rubro: "Conjuntos", subrubro: "Armado tres piezas", marca: "Condeza", familia: "lenceria", tela: "Encaje", colores: ["Rosa", "Blanco", "Negro", "Bordó", "Azul", "Beige"], talles: "85 a 105", aclaracion: "colores y diseños de la foto", proveedorId: "p-bethy", costoDocena: 57_000, pesoBultoKg: 0.7, medidasCm: [32, 18, 9], stockPrendas: 42, reservadoPrendas: 6, ventas30dBultos: 26, estado: "publicado", faltantes: [], publicado: all },
  { sku: "CJATG6", nombre: "Conjunto armado tres piezas Condeza talles grandes", rubro: "Conjuntos", subrubro: "Armado tres piezas grande", marca: "Condeza", familia: "lenceria", tela: null, colores: ["Beige", "Gris", "Rosa", "Violeta", "Blanco"], talles: "100 a 115", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 62_000, pesoBultoKg: 0.75, medidasCm: [34, 18, 10], stockPrendas: 18, reservadoPrendas: 0, ventas30dBultos: 6, estado: "pausado", faltantes: ["SKU repetido: dos productos usan CJATG6", "Tela"], publicado: { dux: true, tiendaNube: false, meta: false } },
  { sku: "CJACN1", nombre: "Conjunto armado dos piezas AmorArma con culote", rubro: "Conjuntos", subrubro: "Armado culote", marca: "AmorArma", familia: "lenceria", tela: "Microfibra", colores: ["Negro", "Terracota", "Beige", "Rosa viejo", "Blanco", "Azul"], talles: "85 a 100", aclaracion: "colores sujetos a stock", proveedorId: "p-silvia", costoDocena: 44_000, pesoBultoKg: 0.5, medidasCm: [30, 18, 8], stockPrendas: 60, reservadoPrendas: 6, ventas30dBultos: 17, estado: "publicado", faltantes: [], publicado: all },
  { sku: "CJALN1", nombre: "Conjunto dos piezas armado Linda Luna con less regulable", rubro: "Conjuntos", subrubro: "Armado less", marca: "Linda Luna", familia: "lenceria", tela: "Microfibra", colores: ["Blanco", "Negro", "Beige"], talles: "90 a 105", aclaracion: "diseño de la foto, colores sujetos a stock", proveedorId: "p-cintia", costoDocena: 44_000, pesoBultoKg: 0.5, medidasCm: [30, 18, 8], stockPrendas: 36, reservadoPrendas: 0, ventas30dBultos: 12, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "CJATN2", nombre: "Conjunto armado tres piezas Need Feel copa C", rubro: "Conjuntos", subrubro: "Tres piezas", marca: "Need Feel", familia: "lenceria", tela: "Encaje", colores: ["Negro", "Blanco", "Marrón", "Rosa", "Violeta", "Verde"], talles: "90 a 105", aclaracion: "colores y diseños de la foto", proveedorId: "p-cintia", costoDocena: 55_000, pesoBultoKg: 0.55, medidasCm: [32, 18, 9], stockPrendas: 9, reservadoPrendas: 6, ventas30dBultos: 14, estado: "publicado", faltantes: [], publicado: all },
  { sku: "CAN9", nombre: "Corpiño armado Smart Sexy con aro y push up", rubro: "Corpiños", subrubro: "Armado", marca: "Smart Sexy", familia: "lenceria", tela: "Microfibra", colores: ["Negro", "Blanco", "Rosa viejo", "Salmón", "Gris", "Beige", "Amarillo", "Celeste"], talles: "85 a 100", aclaracion: "colores sujetos a stock", proveedorId: "p-victoria", costoDocena: 30_800, pesoBultoKg: 0.25, medidasCm: [26, 16, 8], stockPrendas: 132, reservadoPrendas: 18, ventas30dBultos: 38, estado: "publicado", faltantes: [], publicado: all },
  { sku: "CAN12", nombre: "Corpiño armado con encaje en la copa", rubro: "Corpiños", subrubro: "Armado", marca: null, familia: "lenceria", tela: "Encaje", colores: ["Beige", "Salmón", "Azul", "Negro", "Blanco"], talles: "90 a 105", aclaracion: "colores sujetos a stock", proveedorId: "p-victoria", costoDocena: 17_600, pesoBultoKg: 0.25, medidasCm: [26, 16, 8], stockPrendas: 54, reservadoPrendas: 0, ventas30dBultos: 9, estado: "publicado", faltantes: ["Marca"], publicado: duxTn },
  { sku: "CAG1", nombre: "Corpiño armado Smart Sexy talles grandes", rubro: "Corpiños", subrubro: "Armado grande", marca: "Smart Sexy", familia: "lenceria", tela: "Microfibra", colores: ["Negro", "Blanco", "Beige"], talles: "105 a 120", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 35_000, pesoBultoKg: 0.25, medidasCm: [28, 18, 8], stockPrendas: 30, reservadoPrendas: 6, ventas30dBultos: 11, estado: "publicado", faltantes: [], publicado: all },
  { sku: "VN16", nombre: "Vedetina segunda piel Linda Luna sin costura", rubro: "Vedetinas", subrubro: "Normal", marca: "Linda Luna", familia: "lenceria", tela: "Segunda piel", colores: ["Verde oliva", "Azul marino", "Rosado malva", "Blanco", "Rojo vino", "Negro", "Beige"], talles: "M a XXL", aclaracion: "colores sujetos a stock", proveedorId: "p-edgar", costoDocena: 18_000, pesoBultoKg: 0.15, medidasCm: [11, 8, 5], stockPrendas: 120, reservadoPrendas: 12, ventas30dBultos: 33, estado: "publicado", faltantes: [], publicado: all },
  { sku: "VN14", nombre: "Vedetina Calvin Klein con elástico", rubro: "Vedetinas", subrubro: "Normal", marca: "Calvin Klein", familia: "lenceria", tela: "Algodón", colores: ["Lila", "Rosa", "Blanco", "Negro"], talles: "M a XL", aclaracion: "colores sujetos a stock", proveedorId: "p-beatriz", costoDocena: 12_300, pesoBultoKg: 0.15, medidasCm: [12, 9, 10], stockPrendas: 66, reservadoPrendas: 6, ventas30dBultos: 19, estado: "publicado", faltantes: [], publicado: all },
  { sku: "VN25", nombre: "Vedetina morley de algodón Sakura", rubro: "Vedetinas", subrubro: "Normal", marca: "Sakura", familia: "lenceria", tela: "Algodón morley", colores: ["Rosa", "Lila", "Fucsia", "Azul marino", "Salmón", "Celeste"], talles: "M a XL", aclaracion: "colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 8_500, pesoBultoKg: 0.15, medidasCm: [12, 9, 6], stockPrendas: 90, reservadoPrendas: 0, ventas30dBultos: 22, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "VG25", nombre: "Vedetina algodón lycra talle 3XL", rubro: "Vedetinas", subrubro: "Grande", marca: null, familia: "lenceria", tela: "Algodón lycra", colores: ["Beige", "Negro", "Blanco", "Amarillo"], talles: "3XL", aclaracion: "colores sujetos a stock", proveedorId: "p-vilma", costoDocena: 13_000, pesoBultoKg: 0.15, medidasCm: [12, 9, 6], stockPrendas: 24, reservadoPrendas: 0, ventas30dBultos: 4, estado: "listo", faltantes: ["SKU repetido: dos productos usan VG25", "Marca", "Foto de textura"], publicado: { dux: true, tiendaNube: false, meta: false } },
  { sku: "VN31", nombre: "Vedetina morley Need Feel talles grandes", rubro: "Vedetinas", subrubro: "Grande", marca: "Need Feel", familia: "lenceria", tela: "Algodón morley", colores: ["Rojo", "Negro", "Azul", "Rosa", "Verde", "Blanco", "Amarillo"], talles: "L a XXL", aclaracion: "estampados sujetos a stock", proveedorId: "p-victoria", costoDocena: 9_800, pesoBultoKg: 0.15, medidasCm: [16, 11, 2], stockPrendas: 72, reservadoPrendas: 6, ventas30dBultos: 15, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "LN35", nombre: "Less regulable Jenifer con encaje", rubro: "Less", subrubro: "Talles normales", marca: "Jenifer", familia: "lenceria", tela: "Algodón morley", colores: ["Azul", "Rosa", "Rojo", "Blanco", "Fucsia", "Negro", "Violeta", "Verde", "Celeste"], talles: "Talle único 36 a 44", aclaracion: "colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 8_000, pesoBultoKg: 0.1, medidasCm: [8, 5, 4], stockPrendas: 156, reservadoPrendas: 12, ventas30dBultos: 44, estado: "publicado", faltantes: [], publicado: all },
  { sku: "LG18", nombre: "Less morley Linda Luna talles grandes", rubro: "Less", subrubro: "Talles grandes", marca: "Linda Luna", familia: "lenceria", tela: "Algodón morley", colores: ["Negro", "Amarillo", "Rojo", "Rosa", "Verde", "Celeste", "Gris"], talles: "XL a 3XL", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 10_500, pesoBultoKg: 0.125, medidasCm: [6, 6, 4], stockPrendas: 78, reservadoPrendas: 0, ventas30dBultos: 18, estado: "publicado", faltantes: [], publicado: all },
  { sku: "LN66", nombre: "Less segunda piel Linda Luna", rubro: "Less", subrubro: "Talles normales", marca: "Linda Luna", familia: "lenceria", tela: "Segunda piel", colores: ["Negro", "Blanco", "Beige", "Gris", "Rosa"], talles: "M a XXL", aclaracion: "colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 13_000, pesoBultoKg: 0.15, medidasCm: [10, 8, 3], stockPrendas: 48, reservadoPrendas: 6, ventas30dBultos: 13, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "LN177", nombre: "Less regulable con rosa rococó", rubro: "Less", subrubro: "Talles normales", marca: null, familia: "lenceria", tela: "Algodón morley", colores: ["Beige", "Rojo", "Azul", "Rosa", "Blanco", "Negro"], talles: "36 a 44", aclaracion: "colores sujetos a stock", proveedorId: "p-carmen", costoDocena: 9_000, pesoBultoKg: 0.1, medidasCm: [22, 10, 2], stockPrendas: 8, reservadoPrendas: 0, ventas30dBultos: 21, estado: "publicado", faltantes: ["Marca"], publicado: duxTn },
  { sku: "CDTLN6", nombre: "Conjunto deportivo top y less Dlirio", rubro: "Deportivo", subrubro: "Top y less", marca: "Dlirio", familia: "lenceria", tela: "Lycra", colores: ["Celeste", "Beige", "Marrón", "Blanco", "Rosa", "Bordó", "Verde", "Negro"], talles: "M/L y XL/2XL", aclaracion: "colores sujetos a stock", proveedorId: "p-cintia", costoDocena: 52_000, pesoBultoKg: 0.55, medidasCm: [16, 16, 8], stockPrendas: 30, reservadoPrendas: 6, ventas30dBultos: 9, estado: "publicado", faltantes: [], publicado: all },
  { sku: "DSN5", nombre: "Short deportivo Vicblack tiro alto con push up", rubro: "Deportivo", subrubro: "Short", marca: "Vicblack", familia: "lenceria", tela: "Lycra prelavada", colores: ["Azul", "Verde", "Gris", "Beige", "Violeta", "Negro"], talles: "S/M y L/XL", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 55_000, pesoBultoKg: 0.9, medidasCm: [24, 18, 8], stockPrendas: 24, reservadoPrendas: 0, ventas30dBultos: 7, estado: "publicado", faltantes: [], publicado: all },
  { sku: "BCN2", nombre: "Body de encaje Need Feel", rubro: "Body", subrubro: "Encaje", marca: "Need Feel", familia: "lenceria", tela: "Encaje", colores: ["Blanco", "Negro", "Beige", "Rojo", "Azul", "Rosa"], talles: "M/L y XL/2XL", aclaracion: "colores sujetos a stock", proveedorId: "p-cintia", costoDocena: 39_000, pesoBultoKg: 0.425, medidasCm: [24, 16, 6], stockPrendas: 36, reservadoPrendas: 6, ventas30dBultos: 10, estado: "publicado", faltantes: [], publicado: all },
  { sku: "BRN1", nombre: "Body reductor Smart Sexy", rubro: "Body", subrubro: "Reductor", marca: "Smart Sexy", familia: "lenceria", tela: "Microfibra", colores: ["Blanco", "Negro", "Beige"], talles: "M a XXL", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 53_000, pesoBultoKg: 0.75, medidasCm: [26, 18, 8], stockPrendas: 12, reservadoPrendas: 0, ventas30dBultos: 3, estado: "publicado", faltantes: ["Foto de detalle"], publicado: duxTn },
  { sku: "UG9", nombre: "Universal AmorArma microfibra talles grandes", rubro: "Universales", subrubro: "Grande", marca: "AmorArma", familia: "lenceria", tela: "Microfibra tipo morley", colores: ["Beige", "Gris", "Rosa claro", "Rosa fuerte", "Negro", "Azul"], talles: "XL/2XL y 3XL/4XL", aclaracion: "colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 15_000, pesoBultoKg: 0.25, medidasCm: [20, 14, 4], stockPrendas: 60, reservadoPrendas: 0, ventas30dBultos: 12, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "BMN1", nombre: "Boxer de mujer Smart Sexy microfibra", rubro: "Boxer mujer", subrubro: "Normal", marca: "Smart Sexy", familia: "lenceria", tela: "Microfibra", colores: ["Rojo", "Blanco", "Verde menta", "Negro", "Violeta", "Rosa", "Azul"], talles: "M/L y XL/XXL", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 11_000, pesoBultoKg: 0.3, medidasCm: [14, 10, 4], stockPrendas: 84, reservadoPrendas: 6, ventas30dBultos: 20, estado: "publicado", faltantes: [], publicado: all },
  { sku: "HB2", nombre: "Boxer de hombre Uomo de algodón", rubro: "Hombre", subrubro: "Boxer", marca: "Uomo", familia: "lenceria", tela: "Algodón", colores: ["Surtidos"], talles: "M a 4XL", aclaracion: "colores y diseños sujetos a stock, no de la foto", proveedorId: "p-ricardo", costoDocena: 19_800, pesoBultoKg: 0.5, medidasCm: [20, 14, 6], stockPrendas: 72, reservadoPrendas: 12, ventas30dBultos: 24, estado: "publicado", faltantes: [], publicado: all },
  { sku: "HB3", nombre: "Boxer de hombre Calvin Klein algodón y lycra", rubro: "Hombre", subrubro: "Boxer", marca: "Calvin Klein", familia: "lenceria", tela: "Algodón y lycra", colores: ["Verde", "Negro", "Azul", "Gris"], talles: "3XL a 6XL", aclaracion: "colores sujetos a stock", proveedorId: "p-beatriz", costoDocena: 19_500, pesoBultoKg: 0.6, medidasCm: [20, 14, 6], stockPrendas: 42, reservadoPrendas: 0, ventas30dBultos: 8, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "MTNH4", nombre: "Medias 3/4 MD de hombre", rubro: "Medias", subrubro: "Tenis hombre", marca: "MD", familia: "medias", tela: "85 % algodón", colores: ["Gris", "Blanco", "Negro", "Azul marino"], talles: "Talle único", aclaracion: "colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 5_000, pesoBultoKg: 0.5, medidasCm: [28, 19, 4], stockPrendas: 360, reservadoPrendas: 24, ventas30dBultos: 36, estado: "publicado", faltantes: [], publicado: all },
  { sku: "MSN1", nombre: "Soquete Amanecer infantil", rubro: "Medias", subrubro: "Soquete niño", marca: "Amanecer", familia: "medias", tela: "Algodón", colores: ["Surtidos"], talles: "5 a 8", aclaracion: "colores y diseños sujetos a stock, no de la foto", proveedorId: "p-ricardo", costoDocena: 7_000, pesoBultoKg: 0.15, medidasCm: [24, 16, 4], stockPrendas: 288, reservadoPrendas: 0, ventas30dBultos: 30, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "MDTNN5", nombre: "Medias tenis Qiling antideslizantes de niño", rubro: "Medias deportivas", subrubro: "Tenis niño", marca: "Qiling", familia: "medias", tela: "Algodón", colores: ["Blanco", "Gris", "Negro", "Azul", "Verde"], talles: "6 a 8", aclaracion: "colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 16_000, pesoBultoKg: 0.6, medidasCm: [28, 20, 6], stockPrendas: 96, reservadoPrendas: 12, ventas30dBultos: 11, estado: "publicado", faltantes: [], publicado: all },
  { sku: "MLN10", nombre: "Media larga de niño Altomax", rubro: "Medias", subrubro: "Larga niños", marca: "Altomax", familia: "medias", tela: "85 % algodón", colores: ["Rosa", "Celeste", "Blanco", "Verde menta"], talles: "2 a 4", aclaracion: "diseños sujetos a stock", proveedorId: "p-ricardo", costoDocena: 4_300, pesoBultoKg: 0.2, medidasCm: [28, 19, 2], stockPrendas: 240, reservadoPrendas: 0, ventas30dBultos: 26, estado: "publicado", faltantes: [], publicado: all },
  { sku: "PVM3", nombre: "Pijama dos piezas Dlirio diseño cereza", rubro: "Pijamas", subrubro: "Verano mujer", marca: "Dlirio", familia: "lenceria", tela: "Algodón", colores: ["Bordó", "Azul", "Blanco", "Rosa", "Negro"], talles: "M/L y XL/XXL", aclaracion: "diseño de la foto, colores sujetos a stock", proveedorId: "p-ricardo", costoDocena: 70_000, pesoBultoKg: 1, medidasCm: [30, 24, 8], stockPrendas: 18, reservadoPrendas: 6, ventas30dBultos: 5, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "IRTM6", nombre: "Camiseta térmica Linda Luna cuello alto", rubro: "Invierno", subrubro: "Remera térmica mujer", marca: "Linda Luna", familia: "lenceria", tela: "Térmica", colores: ["Negro"], talles: "L/XL y 2XL/3XL", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 48_000, pesoBultoKg: 1.65, medidasCm: [30, 24, 8], stockPrendas: 30, reservadoPrendas: 0, ventas30dBultos: 2, estado: "publicado", faltantes: [], publicado: all },
  { sku: "ICTM1", nombre: "Calza térmica de mujer Linda Luna", rubro: "Invierno", subrubro: "Calza térmica", marca: "Linda Luna", familia: "lenceria", tela: "Térmica tipo morley", colores: ["Negro"], talles: "XL/2XL", aclaracion: "colores sujetos a stock", proveedorId: "p-bethy", costoDocena: 37_000, pesoBultoKg: 1.25, medidasCm: [30, 22, 8], stockPrendas: 42, reservadoPrendas: 0, ventas30dBultos: 1, estado: "publicado", faltantes: [], publicado: duxTn },
  { sku: "MBL1", nombre: "Malla bikini corpiño y less", rubro: "Mallas", subrubro: "Bikini", marca: null, familia: "lenceria", tela: "Lycra", colores: ["Tropicales", "Animal print", "Florales"], talles: "S a XL", aclaracion: "estampados sujetos a stock", proveedorId: "p-ricardo", costoDocena: 60_000, pesoBultoKg: 0.6, medidasCm: [26, 18, 6], stockPrendas: 36, reservadoPrendas: 0, ventas30dBultos: 0, estado: "borrador", faltantes: ["Marca", "Fotos", "Descripción revisada"], publicado: { dux: false, tiendaNube: false, meta: false } },
];

/* ---- Motor de precios (RN-10 a RN-13, RN-95) ------------------------------ */

const ceil100 = (value: number) => Math.ceil(value / 100) * 100;

export type Presentacion = {
  /** Código de DUX: SKU, SKU-6, SKU-12… */
  codigo: string;
  label: string;
  prendas: number;
  /** Precio de venta, redondeado hacia arriba a $100. */
  precio: number;
  /** Costo de la presentación (costo de la prenda × prendas). */
  costo: number;
};

/**
 * Presentaciones de un producto con sus precios piso. El bulto mayorista es
 * el -6 en lencería y el -12 en medias (RN-20b).
 */
export function presentacionesDe(producto: ProductoSeed) {
  const cd = producto.costoDocena;
  const { sku } = producto;

  if (producto.familia === "medias") {
    const bulto: Presentacion = { codigo: `${sku}-12`, label: "Docena", prendas: 12, precio: ceil100(cd * 1.3), costo: cd };
    return {
      bulto,
      lista: [
        { codigo: `${sku}-3`, label: "Pack de 3", prendas: 3, precio: ceil100((cd / 4) * 2.21), costo: cd / 4 },
        { codigo: `${sku}-6`, label: "Pack de 6", prendas: 6, precio: ceil100((cd / 2) * 1.8182), costo: cd / 2 },
        bulto,
      ],
    };
  }

  const bulto: Presentacion = { codigo: `${sku}-6`, label: "Media docena", prendas: 6, precio: ceil100((cd / 2) * 1.3), costo: cd / 2 };
  return {
    bulto,
    lista: [
      { codigo: sku, label: "Prenda", prendas: 1, precio: ceil100((cd / 12) * 2.21), costo: cd / 12 },
      bulto,
      { codigo: `${sku}-12`, label: "Docena", prendas: 12, precio: ceil100(cd * 1.1765), costo: cd },
    ],
  };
}

const bySku = new Map(productos.map((producto) => [producto.sku, producto]));

export function getProducto(sku: string) {
  const producto = bySku.get(sku);
  if (!producto) throw new Error(`No existe el producto ${sku} en la semilla.`);
  return producto;
}

/** Stock disponible en bultos: (real − reservado) ÷ prendas del bulto (RF-M2-01). */
export function bultosDisponibles(producto: ProductoSeed) {
  const { prendas } = presentacionesDe(producto).bulto;
  return Math.floor((producto.stockPrendas - producto.reservadoPrendas) / prendas);
}
