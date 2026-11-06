import type { CatalogoControl } from "@/lib/api/contracts/catalogo";
import { normalizarCodigo } from "./codigos";
import { LISTA_DEL_BULTO } from "./salud";
import { SECCIONES_DE_LA_TIENDA } from "./tienda";

/**
 * El control final (RF-M1-09): lo que está mal en lo que se vende. Se arma solo con lo que ya se
 * leyó de DUX y de la tienda, sin pedirle nada a nadie, y marca: no corrige. Sin base ni red.
 */

export type ProductoDelControl = {
  sku: string;
  nombre: string;
  esCombo: boolean;
  activo: boolean;
  bulto: string | null;
  fotos: number;
};

export type CodigoDelControl = {
  codigo: string;
  base: string;
  tipo: string;
  cantidad: number | null;
  precios: { list: string; cents: number }[];
};

export type ProductoEnLaTienda = {
  id: bigint;
  sku: string | null;
  nombre: string;
  publicado: boolean;
  seccion: string | null;
};

/** La excepción a "un solo bulto" (RN-101): estos dos shorts se publican en -6 y en -12. */
const TAMBIEN_EN_DOCENA = new Set(["DSN10", "DSN11"]);

const FALTA_LEER_LA_TIENDA = "Todavía no se leyó la tienda: se lee cada noche, o desde Integraciones.";

const precioMayorista = ({ precios }: CodigoDelControl) =>
  precios.find(({ list }) => list === LISTA_DEL_BULTO)?.cents ?? 0;

/** Por qué un código publicado no debería estarlo. Null si está bien. */
function problemaDeLoPublicado(sku: string, codigo: CodigoDelControl | undefined, bulto: string | null) {
  if (!codigo) return "No existe en DUX: se despublica, no se borra.";
  if (codigo.tipo === "combo" || codigo.codigo === bulto) return null;
  if (codigo.tipo === "prenda") return "Es la prenda suelta: en la tienda va el bulto.";
  if (codigo.cantidad === 3) return "Es un pack de 3: no se publica.";
  if (TAMBIEN_EN_DOCENA.has(codigo.base) && codigo.cantidad === 12) return null;
  return bulto ? `El bulto es ${bulto}.` : null;
}

export function armarControl({
  productos,
  codigos,
  tienda,
  seLeyoLaTienda,
}: {
  productos: readonly ProductoDelControl[];
  codigos: readonly CodigoDelControl[];
  tienda: readonly ProductoEnLaTienda[];
  seLeyoLaTienda: boolean;
}): CatalogoControl[] {
  const porCodigo = new Map(codigos.map((codigo) => [codigo.codigo, codigo]));
  const productosVendibles = productos.filter(({ esCombo }) => !esCombo);
  const activos = productos.filter(({ activo }) => activo);
  const activosConBulto = activos.filter(({ bulto }) => bulto);
  const publicados = tienda.filter(({ publicado }) => publicado);
  // En la tienda hay códigos escritos con espacios, como "LN 25-6": DUX los tiene sin ellos.
  const enLaTienda = new Set(tienda.flatMap(({ sku }) => (sku ? [normalizarCodigo(sku)] : [])));
  const bultoDe = new Map(productos.map(({ sku, bulto }) => [sku, bulto]));
  const deLaTienda = (producto: ProductoEnLaTienda, detalle: string) => ({
    sku: producto.sku ?? `ID ${producto.id}`,
    nombre: producto.nombre,
    detalle,
  });
  const aviso = seLeyoLaTienda ? null : FALTA_LEER_LA_TIENDA;

  const enLasSecciones = SECCIONES_DE_LA_TIENDA.map((seccion) => ({
    seccion,
    cuantos: tienda.filter((producto) => producto.seccion === seccion).length,
  }));
  const suma = enLasSecciones.reduce((total, { cuantos }) => total + cuantos, 0);

  return [
    {
      id: "precio",
      label: "El bulto tiene precio mayor a $ 0 en el mayorista",
      regla: "RN-101",
      revisados: productos.length,
      fallas: productos.flatMap(({ sku, nombre, bulto, activo }) => {
        if (!bulto) return activo ? [{ sku, nombre, detalle: "No tiene bulto en DUX." }] : [];
        const codigo = porCodigo.get(bulto);
        if (!codigo) return [{ sku, nombre, detalle: `${bulto} no está en DUX.` }];
        return precioMayorista(codigo) > 0 ? [] : [{ sku, nombre, detalle: `${bulto} no tiene precio.` }];
      }),
    },
    {
      id: "prenda-mayorista",
      label: "La prenda suelta no figura en el mayorista",
      regla: "RN-95",
      revisados: productosVendibles.length,
      fallas: productosVendibles.flatMap(({ sku, nombre }) => {
        const prenda = porCodigo.get(sku);
        if (!prenda || prenda.tipo !== "prenda" || precioMayorista(prenda) === 0) return [];
        return [{ sku, nombre, detalle: "Tiene precio en el mayorista." }];
      }),
    },
    {
      id: "tienda-bulto",
      label: "La tienda publica el bulto, no la prenda ni un pack de 3",
      regla: "RN-09",
      revisados: publicados.length,
      aviso,
      fallas: publicados.flatMap((producto) => {
        if (!producto.sku) return [deLaTienda(producto, "No tiene SKU: no se puede cruzar.")];
        const codigo = porCodigo.get(normalizarCodigo(producto.sku));
        const problema = problemaDeLoPublicado(
          producto.sku,
          codigo,
          codigo ? (bultoDe.get(codigo.base) ?? null) : null,
        );
        return problema ? [deLaTienda(producto, problema)] : [];
      }),
    },
    {
      id: "tienda-falta",
      label: "Lo activo está en la tienda",
      regla: "RN-09",
      revisados: seLeyoLaTienda ? activosConBulto.length : 0,
      aviso,
      fallas: seLeyoLaTienda
        ? activosConBulto.flatMap(({ sku, nombre, bulto }) =>
            enLaTienda.has(bulto!) ? [] : [{ sku, nombre, detalle: `${bulto} no está en la tienda.` }],
          )
        : [],
    },
    {
      id: "foto",
      label: "Lo activo tiene foto",
      regla: "RN-09",
      revisados: activos.length,
      fallas: activos.flatMap(({ sku, nombre, fotos }) =>
        fotos > 0 ? [] : [{ sku, nombre, detalle: "No tiene foto." }],
      ),
    },
    {
      id: "secciones",
      label: `Las 7 secciones suman el total de la tienda (${suma} de ${tienda.length})`,
      regla: "RN-102",
      revisados: tienda.length,
      aviso,
      fallas: tienda.flatMap((producto) =>
        producto.seccion ? [] : [deLaTienda(producto, "No cuelga de ninguna sección: no aparece en ningún menú.")],
      ),
    },
  ];
}
