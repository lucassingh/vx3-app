import { calcularPresentaciones, ceilTo, margenDe } from "@/modules/catalog/motor-precios";
import { erroresDeAlta } from "@/modules/catalog/reglas-alta";
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
  CatalogoFicha,
  CatalogoFila,
  CatalogoFoto,
  CatalogoProducto,
  CatalogoVigencia,
  Kpi,
} from "@/lib/api/types";
import { normalizeText } from "@/lib/utils";
import { facetasDe, leerQueryDelCatalogo, pasaLosFiltros, type ProductoFiltrable } from "@/modules/catalog/filtros";
import { defineStore } from "../db";
import { errorResponse, paginate, readJson, type Route } from "../http";
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

const VIGENCIA_DE_EJEMPLO: Record<CatalogoEstado, CatalogoVigencia> = {
  borrador: "activo",
  listo: "activo",
  publicado: "activo",
  pausado: "agotado",
};

const aFiltrable = (item: CatalogoProducto): ProductoFiltrable => ({
  rubro: item.rubro,
  subrubro: item.subrubro,
  marca: item.marca,
  tela: item.tela,
  talle: item.talles,
  colores: item.colores,
  proveedor: item.proveedor,
  vigencia: VIGENCIA_DE_EJEMPLO[item.estado],
  listo: item.faltantes.length === 0,
  texto: normalizeText(`${item.sku} ${item.nombre} ${item.marca ?? ""}`),
});

const aFila = (item: CatalogoProducto): CatalogoFila => ({
  sku: item.sku,
  nombre: item.nombre,
  rubro: item.rubro,
  subrubro: item.subrubro,
  marca: item.marca,
  colores: item.colores,
  vigencia: VIGENCIA_DE_EJEMPLO[item.estado],
  deTemporada: false,
  prioridad: item.ventas30dBultos > 0 ? "A" : "C",
  foto: null,
  bulto: item.bulto,
  bultosDisponibles: item.bultosDisponibles,
  listoParaVender: item.faltantes.length === 0,
  faltantes: item.faltantes.map((dato) => ({ dato, situacion: "falta", bloquea: true, seCorrigeEn: "Sheet" })),
});

const aFicha = (item: CatalogoProducto): CatalogoFicha => ({
  ...aFila(item),
  tela: item.tela,
  coloresTexto: item.colores.join(", "),
  talles: item.talles,
  proveedor: item.proveedor,
  atributos: [],
  medidasCm: item.medidasCm,
  pesoKg: item.pesoBultoKg,
  ranking: null,
  ultimaVenta: null,
  enSheet: true,
  filaDelSheet: null,
  enDux: true,
  presentaciones: item.presentaciones.map(({ codigo, label, prendas, precio, listas, esBulto }) => ({
    codigo,
    label,
    prendas,
    precio,
    listas,
    esBulto,
    disponible: item.bultosDisponibles,
    enDux: true,
  })),
  fotos: [],
});

const queryDe = (url: URL) => leerQueryDelCatalogo((nombre) => url.searchParams.get(nombre));

function listar(url: URL) {
  const query = queryDe(url);
  const items = getCatalogo()
    .productos.map(toCatalogoProducto)
    .filter((item) => pasaLosFiltros(aFiltrable(item), query));
  return paginate(items.map(aFila), url, 24);
}

function kpis(): Kpi[] {
  const items = getCatalogo().productos.map(toCatalogoProducto);
  const de = (vigencia: CatalogoVigencia) => items.filter((item) => VIGENCIA_DE_EJEMPLO[item.estado] === vigencia);
  return [
    { id: "productos", label: "Productos", value: items.length, format: "number", hint: "Datos de ejemplo" },
    {
      id: "activos",
      label: "Activos",
      value: de("activo").length,
      format: "number",
      hint: `${de("activo").filter((item) => item.faltantes.length === 0).length} listos para vender`,
    },
    { id: "agotados", label: "Agotados", value: de("agotado").length, format: "number", hint: "0 de temporada" },
    {
      id: "historicos",
      label: "Históricos",
      value: de("historico").length,
      format: "number",
      hint: "Fuera del catálogo, pero se pueden buscar",
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

const facetas = (url: URL): CatalogoFacetas =>
  facetasDe(getCatalogo().productos.map(toCatalogoProducto).map(aFiltrable), queryDe(url));

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
      rubro.subrubros.push({
        nombre: producto.subrubro,
        prefijo,
        proximoSku: proximoSku(prefijo, skus),
      });
    }
  }

  return {
    rubros: [...rubros.values()],
    marcas: [...new Set(getCatalogo().productos.flatMap(({ marca }) => (marca ? [marca] : [])))].toSorted(),
    proveedores: proveedores.map(({ id, nombre }) => ({ id, nombre, conProductos: true })),
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
    atributos: [],
    codigosUsados: items.map((item) => item.sku),
    mediaUrl: null,
    escrituraEnDux: { puede: true, motivo: null },
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
    aclaracion: input.color ?? "colores sujetos a stock",
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
  { method: "GET", pattern: /^\/catalogo\/facetas$/, handler: ({ url }) => Response.json(facetas(url)) },
  {
    method: "GET",
    pattern: /^\/catalogo\/ejemplo\/rubros$/,
    handler: () => Response.json([...new Set(getCatalogo().productos.map(({ rubro }) => rubro))]),
  },
  // La cola sale de la importación: en la maqueta no hay nada para revisar.
  {
    method: "GET",
    pattern: /^\/catalogo\/revision$/,
    handler: () => Response.json({ bloques: [], casos: 0, actualizadoEl: null }),
  },
  {
    method: "GET",
    pattern: /^\/catalogo\/revision\/casos$/,
    handler: ({ url }) => Response.json(paginate([], url, 20)),
  },
  { method: "GET", pattern: /^\/catalogo\/revision\/decisiones$/, handler: () => Response.json([]) },
  { method: "GET", pattern: /^\/catalogo\/control$/, handler: () => Response.json(control()) },
  { method: "GET", pattern: /^\/catalogo\/productos$/, handler: ({ url }) => Response.json(listar(url)) },
  {
    method: "GET",
    pattern: /^\/catalogo\/productos\/([^/]+)$/,
    handler: ({ params: [sku] }) => {
      const producto = getCatalogo().productos.find((item) => item.sku === decodeURIComponent(sku));
      return producto
        ? Response.json(aFicha(toCatalogoProducto(producto)))
        : errorResponse(404, `No existe el producto ${sku}.`);
    },
  },
  { method: "GET", pattern: /^\/catalogo\/alta\/borradores$/, handler: () => Response.json([]) },
  { method: "GET", pattern: /^\/catalogo\/alta\/parecidos$/, handler: () => Response.json([]) },
  { method: "GET", pattern: /^\/catalogo\/alta\/opciones$/, handler: () => Response.json(altaOpciones()) },
  { method: "POST", pattern: /^\/catalogo\/alta\/publicar$/, handler: ({ request }) => publicar(request) },
  { method: "GET", pattern: /^\/catalogo\/combos$/, handler: ({ url }) => Response.json(combos(url)) },
];
