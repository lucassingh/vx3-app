import { calcularPresentaciones, ceilTo, margenDe } from "@/components/productos/motor-precios";
import { erroresDeAlta } from "@/components/productos/reglas-alta";
import type {
  CatalogoAltaInput,
  CatalogoAltaOpciones,
  CatalogoAltaPaso,
  CatalogoCombo,
  CatalogoCombosModo,
  CatalogoCombosResultado,
  CatalogoControl,
  CatalogoEstado,
  CatalogoFacetas,
  CatalogoFoto,
  CatalogoProducto,
  Kpi,
} from "@/lib/api/types";
import { normalizeText } from "@/lib/utils";
import { defineStore } from "../db";
import { errorResponse, readJson, type Route } from "../http";
import { bultosDisponibles, productos, proveedores, type ProductoSeed } from "../seed";

/** M1 · Catálogo maestro. Los productos nuevos del alta quedan en memoria. */

const getCatalogo = defineStore("catalogo", () => ({
  productos: productos.map((producto) => structuredClone(producto)),
}));

const proveedorNombre = (id: string) => proveedores.find((item) => item.id === id)?.nombre ?? "Sin proveedor";

const FOTOS: Omit<CatalogoFoto, "cargada">[] = [
  { tipo: "colores", label: "Todos los colores" },
  { tipo: "comercial", label: "Comercial" },
  { tipo: "textura", label: "Textura y calidad" },
  { tipo: "detalle", label: "Detalle para IA" },
];

function fotosDe(producto: ProductoSeed): CatalogoFoto[] {
  const sinFotos = producto.faltantes.includes("Fotos");
  return FOTOS.map((foto) => ({
    ...foto,
    cargada:
      !sinFotos &&
      !(foto.tipo === "textura" && producto.faltantes.includes("Foto de textura")) &&
      !(foto.tipo === "detalle" && producto.faltantes.includes("Foto de detalle")),
  }));
}

/** Descripción armada con los atributos, omitiendo los vacíos (RN-103). */
function descripcionDe(producto: ProductoSeed, bulto: { label: string; prendas: number }) {
  return [
    producto.nombre + ".",
    producto.marca && `Marca: ${producto.marca}.`,
    `Pack: ${bulto.label.toLowerCase()} (${bulto.prendas} prendas).`,
    `Colores: ${producto.colores.join(", ").toLowerCase()}, ${producto.aclaracion}.`,
    `Talles: ${producto.talles}.`,
    producto.tela && `Tela: ${producto.tela.toLowerCase()}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function toCatalogoProducto(producto: ProductoSeed): CatalogoProducto {
  const presentaciones = calcularPresentaciones(producto.familia, producto.sku, producto.costoDocena);
  const bulto = presentaciones.find((item) => item.esBulto)!;
  return {
    sku: producto.sku,
    nombre: producto.nombre,
    rubro: producto.rubro,
    subrubro: producto.subrubro,
    marca: producto.marca,
    proveedorId: producto.proveedorId,
    proveedor: proveedorNombre(producto.proveedorId),
    familia: producto.familia,
    tela: producto.tela,
    colores: producto.colores,
    talles: producto.talles,
    aclaracion: producto.aclaracion,
    estado: producto.estado,
    faltantes: producto.faltantes,
    completoParaBot:
      producto.faltantes.length === 0 && producto.estado === "publicado" && Boolean(producto.marca && producto.tela),
    publicado: producto.publicado,
    bulto: { codigo: bulto.codigo, label: bulto.label, precio: bulto.precio },
    bultosDisponibles: Math.max(0, bultosDisponibles(producto)),
    ventas30dBultos: producto.ventas30dBultos,
    costoDocena: producto.costoDocena,
    margenBulto: margenDe(bulto.precio, bulto.costo),
    pesoBultoKg: producto.pesoBultoKg,
    medidasCm: producto.medidasCm,
    stockPrendas: producto.stockPrendas,
    reservadoPrendas: producto.reservadoPrendas,
    presentaciones: presentaciones.map(({ codigo, label, prendas, precio, costo, listas, esBulto }) => ({
      codigo,
      label,
      prendas,
      precio,
      costo,
      listas,
      esBulto,
    })),
    fotos: fotosDe(producto),
    descripcion: {
      texto: descripcionDe(producto, bulto),
      revisada: !producto.faltantes.includes("Descripción revisada") && producto.estado !== "borrador",
    },
  };
}

const ESTADOS: CatalogoEstado[] = ["borrador", "listo", "publicado", "pausado"];

function listar(url: URL) {
  const q = normalizeText(url.searchParams.get("q")?.trim() ?? "");
  const rubro = url.searchParams.get("rubro");
  const marca = url.searchParams.get("marca");
  const proveedor = url.searchParams.get("proveedor");
  const estado = url.searchParams.get("estado") as CatalogoEstado | null;
  const salud = url.searchParams.get("salud");

  return getCatalogo()
    .productos.map(toCatalogoProducto)
    .filter((item) => (q ? normalizeText(`${item.sku} ${item.nombre} ${item.marca ?? ""}`).includes(q) : true))
    .filter((item) => (rubro ? item.rubro === rubro : true))
    .filter((item) => (marca ? item.marca === marca : true))
    .filter((item) => (proveedor ? item.proveedorId === proveedor : true))
    .filter((item) => (estado && ESTADOS.includes(estado) ? item.estado === estado : true))
    .filter((item) =>
      salud === "completo" ? item.completoParaBot : salud === "con_faltantes" ? !item.completoParaBot : true,
    );
}

function kpis(): Kpi[] {
  const items = getCatalogo().productos.map(toCatalogoProducto);
  const completos = items.filter((item) => item.completoParaBot).length;
  const repetidos = items.filter((item) => item.faltantes.some((f) => f.startsWith("SKU repetido"))).length;
  const sinMarca = items.filter((item) => !item.marca).length;
  return [
    {
      id: "productos",
      label: "Productos en el catálogo",
      value: items.length,
      format: "number",
      hint: `${items.filter((item) => item.estado === "publicado").length} publicados en DUX`,
    },
    {
      id: "completos",
      label: "Completos para el bot",
      value: completos / items.length,
      format: "percent",
      hint: "Atributos, marca, tela y las 4 fotos",
    },
    {
      id: "repetidos",
      label: "SKUs repetidos",
      value: repetidos,
      format: "number",
      hint: "Se resuelven antes de publicar",
    },
    {
      id: "sin-marca",
      label: "Sin marca",
      value: sinMarca,
      format: "number",
      hint: "Tienen que existir en DUX escritas igual",
    },
  ];
}

function control(): CatalogoControl[] {
  const items = getCatalogo().productos.map(toCatalogoProducto);
  const publicados = items.filter((item) => item.publicado.dux);
  const ref = (item: CatalogoProducto, detalle: string) => ({ sku: item.sku, nombre: item.nombre, detalle });
  return [
    {
      id: "prenda-mayorista",
      label: "La prenda no figura en el catálogo mayorista",
      regla: "RN-09b",
      revisados: publicados.length,
      fallas: [],
    },
    {
      id: "precio",
      label: "El bulto tiene precio mayor a $ 0 en MAYORISTA EF/TR",
      regla: "RN-09b",
      revisados: publicados.length,
      fallas: publicados.filter((item) => item.bulto.precio <= 0).map((item) => ref(item, "Precio en $ 0")),
    },
    {
      id: "tienda-nube",
      label: "Tienda Nube publica el bulto, no la prenda",
      regla: "RN-09",
      revisados: items.filter((item) => item.publicado.tiendaNube).length,
      fallas: [],
    },
    {
      id: "fotos",
      label: "Tiene las 4 fotos (colores, comercial, textura y detalle)",
      regla: "RN-08",
      revisados: items.length,
      fallas: items
        .filter((item) => item.fotos.some((foto) => !foto.cargada))
        .map((item) =>
          ref(
            item,
            `Falta: ${item.fotos
              .filter((foto) => !foto.cargada)
              .map((foto) => foto.label.toLowerCase())
              .join(", ")}`,
          ),
        ),
    },
    {
      id: "sku-unico",
      label: "El SKU es único",
      regla: "RN-98",
      revisados: items.length,
      fallas: items
        .filter((item) => item.faltantes.some((f) => f.startsWith("SKU repetido")))
        .map((item) => ref(item, "Dos productos distintos usan el mismo código")),
    },
    {
      id: "marca",
      label: "La marca existe en DUX escrita igual",
      regla: "RN-07",
      revisados: items.length,
      fallas: items.filter((item) => !item.marca).map((item) => ref(item, "Sin marca cargada")),
    },
  ];
}

function facetas(): CatalogoFacetas {
  const items = getCatalogo().productos;
  return {
    rubros: [...new Set(items.map((item) => item.rubro))],
    marcas: [...new Set(items.flatMap((item) => (item.marca ? [item.marca] : [])))].toSorted(),
    proveedores: proveedores.map(({ id, nombre }) => ({ id, nombre })),
  };
}

/* ---- Alta ---------------------------------------------------------------- */

/** Último correlativo de cada prefijo en DUX (el catálogo completo tiene más SKUs que la semilla). */
const ULTIMO_EN_DUX: Record<string, number> = {
  CJATN: 41,
  CJATG: 9,
  CJACN: 4,
  CJALN: 5,
  CAN: 18,
  CAG: 4,
  VN: 33,
  VG: 27,
  LN: 181,
  LG: 21,
  CDTLN: 9,
  DSN: 5,
  BCN: 4,
  BRN: 2,
  UG: 9,
  BMN: 5,
  HB: 5,
  MTNH: 4,
  MSN: 7,
  MDTNN: 6,
  MLN: 10,
  PVM: 5,
  IRTM: 6,
  ICTM: 1,
  MBL: 1,
};

const prefijoDe = (sku: string) => sku.replace(/\d+$/, "");

function proximoSku(prefijo: string, skus: string[]) {
  const usados = skus.filter((sku) => prefijoDe(sku) === prefijo).map((sku) => Number(sku.slice(prefijo.length)) || 0);
  return `${prefijo}${Math.max(ULTIMO_EN_DUX[prefijo] ?? 0, ...usados) + 1}`;
}

function nombreBaseDe(producto: ProductoSeed) {
  if (producto.marca) {
    const index = producto.nombre.indexOf(producto.marca);
    if (index > 0) return producto.nombre.slice(0, index).trim();
  }
  const singular = producto.rubro.replace(/s$/, "");
  return producto.subrubro === "Normal" ? singular : `${singular} ${producto.subrubro.toLowerCase()}`;
}

function altaOpciones(): CatalogoAltaOpciones {
  const items = getCatalogo().productos;
  const skus = items.map((item) => item.sku);
  const rubros = new Map<string, CatalogoAltaOpciones["rubros"][number]>();

  for (const producto of items) {
    const rubro = rubros.get(producto.rubro) ?? { rubro: producto.rubro, familia: producto.familia, subrubros: [] };
    rubros.set(producto.rubro, rubro);
    const existente = rubro.subrubros.find((sub) => sub.nombre === producto.subrubro);
    if (!existente) {
      const prefijo = prefijoDe(producto.sku);
      const conMarca = items.find(
        (item) => item.subrubro === producto.subrubro && item.rubro === producto.rubro && item.marca,
      );
      rubro.subrubros.push({
        nombre: producto.subrubro,
        prefijo,
        proximoSku: proximoSku(prefijo, skus),
        nombreBase: nombreBaseDe(conMarca ?? producto),
      });
    }
  }

  return {
    rubros: [...rubros.values()],
    marcas: facetas().marcas,
    proveedores: proveedores.map(({ id, nombre }) => ({ id, nombre })),
    telas: [
      "Algodón",
      "Algodón lycra",
      "Algodón morley",
      "Encaje",
      "Lycra",
      "Microfibra",
      "Microfibra con encaje",
      "Segunda piel",
      "Térmica",
    ],
    colores: [
      "Blanco",
      "Negro",
      "Beige",
      "Rosa",
      "Rosa viejo",
      "Rosa claro",
      "Fucsia",
      "Rojo",
      "Bordó",
      "Azul",
      "Azul marino",
      "Celeste",
      "Verde",
      "Verde oliva",
      "Verde menta",
      "Gris",
      "Lila",
      "Violeta",
      "Salmón",
      "Amarillo",
      "Marrón",
      "Terracota",
      "Surtidos",
    ],
    aclaraciones: [
      "diseño de la foto, colores sujetos a stock",
      "colores y diseños de la foto",
      "colores y diseños sujetos a stock, no de la foto",
      "estampados sujetos a stock",
    ],
    skus: items.map((item) => ({ sku: item.sku, nombre: item.nombre, rubro: item.rubro })),
  };
}

function nuevoProducto(input: Partial<CatalogoAltaInput>, estado: CatalogoEstado): ProductoSeed {
  const familia = getCatalogo().productos.find((item) => item.rubro === input.rubro)?.familia ?? "lenceria";
  const faltantes = [!input.marca && "Marca", !input.tela && "Tela", estado === "borrador" && "Fotos"].filter(
    (item): item is string => Boolean(item),
  );
  return {
    sku: (input.sku ?? "").trim().toUpperCase(),
    nombre: input.nombre ?? "",
    rubro: input.rubro ?? "",
    subrubro: input.subrubro ?? "",
    marca: input.marca || null,
    familia,
    tela: input.tela || null,
    colores: input.colores ?? [],
    talles: input.talles ?? "",
    aclaracion: input.aclaracion ?? "colores sujetos a stock",
    proveedorId: input.proveedorId ?? "",
    costoDocena: input.costoDocena ?? 0,
    pesoBultoKg: input.pesoBultoKg ?? 0,
    medidasCm: input.medidasCm ?? [0, 0, 0],
    stockPrendas: 0,
    reservadoPrendas: 0,
    ventas30dBultos: 0,
    estado,
    faltantes,
    publicado: { dux: estado === "publicado", tiendaNube: estado === "publicado", meta: false },
  };
}

const PASOS: Record<CatalogoAltaPaso, (sku: string) => string> = {
  dux: (sku) => `Prenda ${sku} y sus compuestos creados en DUX (POST /v2/items con kit_item).`,
  precios: () => "Precios cargados en MAYORISTA EF/TR y LOCAL EF/TR.",
  tiendanube: (sku) => `Bulto publicado en Tienda Nube con galería y descripción (${sku}).`,
};

async function publicar(request: Request) {
  const { input, paso } = await readJson<{ input: CatalogoAltaInput; paso: CatalogoAltaPaso }>(request);
  if (!input || !paso || !(paso in PASOS)) return errorResponse(400, "Faltan los datos del producto o el paso.");

  const catalogo = getCatalogo();
  const sku = (input.sku ?? "").trim().toUpperCase();
  const existentes = catalogo.productos
    .filter((item) => item.estado !== "borrador" || item.sku !== sku)
    .map((item) => item.sku);

  if (paso === "dux") {
    const [error] = erroresDeAlta(input, existentes);
    if (error) return errorResponse(422, error.mensaje);
  }
  if (paso === "tiendanube") {
    catalogo.productos = [nuevoProducto(input, "publicado"), ...catalogo.productos.filter((item) => item.sku !== sku)];
  }
  return Response.json({ sku, paso, detalle: PASOS[paso](sku) });
}

async function guardarBorrador(request: Request) {
  const { input } = await readJson<{ input: Partial<CatalogoAltaInput> }>(request);
  const sku = (input?.sku ?? "").trim().toUpperCase();
  if (!sku) return errorResponse(422, "Para guardar el borrador hace falta al menos el SKU.");
  const catalogo = getCatalogo();
  catalogo.productos = [
    nuevoProducto(input ?? {}, "borrador"),
    ...catalogo.productos.filter((item) => item.sku !== sku),
  ];
  return Response.json({ sku, paso: "borrador", detalle: "Borrador guardado en la app. No se publicó en DUX." });
}

/* ---- Combos sugeridos (RN-108, RN-109) ------------------------------------ */

const COMBO_MIN = 45_000;
const COMBO_MAX = 60_000;

function combos(url: URL): CatalogoCombosResultado {
  const modo = (url.searchParams.get("modo") ?? "margen") as CatalogoCombosModo;
  const categoria = url.searchParams.get("categoria") ?? "";
  const forzados = (url.searchParams.get("forzar") ?? "")
    .split(",")
    .map((sku) => sku.trim().toUpperCase())
    .filter(Boolean);

  const quiebres = getCatalogo()
    .productos.filter((item) => item.ventas30dBultos > 0)
    .map((item) => ({ item, bultos: Math.max(0, bultosDisponibles(item)), semanal: item.ventas30dBultos / 4 }))
    .filter(({ bultos, semanal }) => bultos < semanal)
    .map(({ item, bultos, semanal }) => ({
      sku: item.sku,
      nombre: item.nombre,
      bultos,
      rotacionSemanal: Math.round(semanal * 10) / 10,
    }));
  const enQuiebre = new Set(quiebres.map((item) => item.sku));

  // Lo que está en quiebre no entra en un combo, salvo que se lo fuerce.
  const candidatos = getCatalogo()
    .productos.filter(
      (item) =>
        item.estado === "publicado" &&
        bultosDisponibles(item) >= 1 &&
        (!enQuiebre.has(item.sku) || forzados.includes(item.sku)),
    )
    .map((item) => {
      const bulto = calcularPresentaciones(item.familia, item.sku, item.costoDocena).find((p) => p.esBulto)!;
      const disponibles = bultosDisponibles(item);
      const diasStock = item.ventas30dBultos > 0 ? disponibles / (item.ventas30dBultos / 30) : 999;
      return { item, bulto, disponibles, diasStock, margen: margenDe(bulto.precio, bulto.costo) };
    });

  const orden = candidatos.toSorted((a, b) =>
    modo === "margen"
      ? b.margen * b.item.ventas30dBultos - a.margen * a.item.ventas30dBultos
      : b.diasStock - a.diasStock,
  );

  const fijos = orden.filter((c) => forzados.includes(c.item.sku));
  // En los modos de liquidación cada combo lleva un "ancla": un producto de la
  // categoría elegida o de los que tienen más días de stock.
  const anclas = orden
    .filter((c) => !forzados.includes(c.item.sku))
    .filter((c) => (modo === "liquidar_categoria" ? c.item.rubro === categoria : modo === "liquidar_stock"))
    .slice(0, modo === "liquidar_stock" ? 4 : undefined);
  const resto = orden.filter((c) => !forzados.includes(c.item.sku) && !anclas.includes(c));

  const apariciones = new Map<string, number>();
  const resultado: CatalogoCombo[] = [];

  for (let intento = 0; intento < resto.length && resultado.length < 6; intento++) {
    const ancla = anclas[intento % anclas.length];
    const elegidos = ancla ? [...fijos, ancla] : [...fijos];
    let total = elegidos.reduce((sum, c) => sum + c.bulto.precio, 0);
    // El relleno va del más barato al más caro para que entre en el rango.
    const relleno = anclas.length > 0 ? resto.toSorted((a, b) => a.bulto.precio - b.bulto.precio) : resto;
    const rotados = [...relleno.slice(intento), ...relleno.slice(0, intento)];

    for (const candidato of rotados) {
      if (elegidos.length >= 6 || (elegidos.length >= 4 && total >= COMBO_MIN)) break;
      if ((apariciones.get(candidato.item.sku) ?? 0) >= 5) continue;
      if (total + candidato.bulto.precio > COMBO_MAX) continue;
      elegidos.push(candidato);
      total += candidato.bulto.precio;
    }
    if (elegidos.length < 4 || total < COMBO_MIN) continue;

    const firma = elegidos
      .map((c) => c.item.sku)
      .toSorted()
      .join("+");
    if (
      resultado.some(
        (combo) =>
          combo.items
            .map((i) => i.sku)
            .toSorted()
            .join("+") === firma,
      )
    )
      continue;

    for (const c of elegidos) apariciones.set(c.item.sku, (apariciones.get(c.item.sku) ?? 0) + 1);
    const costo = elegidos.reduce((sum, c) => sum + c.bulto.costo, 0);
    const totalRedondeado = ceilTo(total, 500);
    const margen = margenDe(totalRedondeado, costo);
    resultado.push({
      id: `combo-${resultado.length + 1}`,
      nombre: `Combo ${["Ocre", "Rosa", "Clásico", "Revendedora", "Surtido", "Express"][resultado.length]}`,
      items: elegidos.map((c) => ({
        sku: c.item.sku,
        codigo: c.bulto.codigo,
        nombre: c.item.nombre,
        colores: c.item.colores,
        prendas: c.bulto.prendas,
        precio: c.bulto.precio,
        costo: c.bulto.costo,
      })),
      bultos: elegidos.length,
      prendas: elegidos.reduce((sum, c) => sum + c.bulto.prendas, 0),
      total: totalRedondeado,
      costo: Math.round(costo),
      margen,
      avisoMargen: margen < 0.1,
    });
  }

  return {
    combos: resultado,
    quiebres,
    sospechosos: [
      {
        sku: "ICTM1",
        nombre: "Calza térmica de mujer Linda Luna",
        margenAparente: 0.85,
        margenReal: 0.23,
        motivo: "DUX tiene congelado el costo de una compra del año pasado.",
      },
      {
        sku: "MSN1",
        nombre: "Soquete Amanecer infantil",
        margenAparente: -0.04,
        margenReal: 0.23,
        motivo: "Costo cargado por docena en la prenda: margen negativo aparente.",
      },
    ],
  };
}

export const routes: Route[] = [
  { method: "GET", pattern: /^\/catalogo\/kpis$/, handler: () => Response.json(kpis()) },
  { method: "GET", pattern: /^\/catalogo\/facetas$/, handler: () => Response.json(facetas()) },
  { method: "GET", pattern: /^\/catalogo\/control$/, handler: () => Response.json(control()) },
  { method: "GET", pattern: /^\/catalogo\/productos$/, handler: ({ url }) => Response.json(listar(url)) },
  {
    method: "GET",
    pattern: /^\/catalogo\/productos\/([^/]+)$/,
    handler: ({ params: [sku] }) => {
      const producto = getCatalogo().productos.find((item) => item.sku === decodeURIComponent(sku));
      return producto
        ? Response.json(toCatalogoProducto(producto))
        : errorResponse(404, `No existe el producto ${sku}.`);
    },
  },
  { method: "GET", pattern: /^\/catalogo\/alta\/opciones$/, handler: () => Response.json(altaOpciones()) },
  { method: "POST", pattern: /^\/catalogo\/alta\/publicar$/, handler: ({ request }) => publicar(request) },
  { method: "POST", pattern: /^\/catalogo\/alta\/borrador$/, handler: ({ request }) => guardarBorrador(request) },
  { method: "GET", pattern: /^\/catalogo\/combos$/, handler: ({ url }) => Response.json(combos(url)) },
];
