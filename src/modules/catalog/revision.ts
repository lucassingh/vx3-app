import type { CatalogoArmado, ProductoArmado } from "./armar";
import type { CodigoDelEspejo, EvaluacionDelProducto } from "./salud";

/**
 * La cola de revisión (`solucion_doc/06` §6.2): lo que la regla del dueño de cada dato no decide,
 * y dónde se corrige. Sin base ni red. Se regenera en cada importación: lo corregido en la fuente
 * desaparece solo. No compara nombres: se cruza por SKU, y VX3 está renombrando todo (RN-127).
 *
 * Lo de un producto se le pide solo a los activos (`03` §6): un agotado entra cuando vuelve a
 * tener stock, y un histórico sale de la revisión (RN-125).
 */

export type GrupoDeRevision = "para_vender" | "historicos" | "despues";
export type FuenteDeCorreccion = "sheet" | "dux" | "drive" | "app";

export const BLOQUES = [
  {
    id: "codigos",
    grupo: "para_vender",
    titulo: "Códigos que no cierran",
    ayuda: "Filas del Sheet con el código repetido, un pack viejo o sin SKU. Hasta corregirlas no entran al catálogo.",
  },
  {
    id: "sin_fila",
    grupo: "para_vender",
    titulo: "Activos sin fila en el Sheet",
    ayuda: "Sin peso ni medidas no se puede cotizar el envío, y no se pueden publicar.",
  },
  {
    id: "envio",
    grupo: "para_vender",
    titulo: "Peso y medidas que faltan",
    ayuda: "Sin esto no se puede cotizar el envío. El peso va en kg y las medidas en cm.",
  },
  {
    id: "precio_costo",
    grupo: "para_vender",
    titulo: "Precio o costo que no cierra",
    ayuda: "Falta el precio del bulto o el costo, o el costo no es menor que el precio.",
  },
  {
    id: "sin_foto",
    grupo: "para_vender",
    titulo: "Activos sin ninguna foto",
    ayuda: "No tienen fotos en Drive ni en DUX. Se suben a Drive con el código en el nombre.",
  },
  {
    id: "rubro_distinto",
    grupo: "para_vender",
    titulo: "Rubro distinto entre el Sheet y DUX",
    ayuda: "Vale el del Sheet, pero una persona lo tiene que mirar: de eso depende cuál es el bulto (RN-115).",
  },
  {
    id: "fotos_sueltas",
    grupo: "para_vender",
    titulo: "Fotos sin producto",
    ayuda: "Su nombre no lleva a ningún código. Decí de qué producto son, o descartalas.",
  },
  {
    id: "historicos",
    grupo: "historicos",
    titulo: "Históricos por confirmar",
    ayuda:
      "Sin stock y sin ventas hace 6 meses o más. Se confirman todos juntos, y antes se saca lo que no sea. Nunca se borran: si vuelve a tener stock, vuelve solo como activo.",
  },
  {
    id: "marca_distinta",
    grupo: "despues",
    titulo: "Marca distinta entre el Sheet y DUX",
    ayuda: "Vale la del Sheet. Si el Sheet estaba mal, es la que queda.",
  },
  {
    id: "foto_solo_dux",
    grupo: "despues",
    titulo: "Activos con la foto de DUX, nada más",
    ayuda: "Tiene 400 px: alcanza para vender, no para una vidriera.",
  },
  {
    id: "atributos",
    grupo: "despues",
    titulo: "Tela, marca o proveedor que faltan",
    ayuda: 'No frena la venta, pero el bot no puede contestar "¿de qué tela es?". Si no se tiene, va NO HAY DATO.',
  },
] as const satisfies readonly { id: string; grupo: GrupoDeRevision; titulo: string; ayuda: string }[];

export type BloqueDeRevision = (typeof BLOQUES)[number]["id"];

export type CasoDeRevision = {
  block: BloqueDeRevision;
  /** La llave natural dentro del bloque: un código o un archivo de Drive. */
  key: string;
  baseCode: string | null;
  priority: EvaluacionDelProducto["prioridad"] | null;
  salesRank: number | null;
  description: string;
  fixIn: FuenteDeCorreccion;
  sheetRow: number | null;
  details: Record<string, string | string[]>;
};

/** Margen bajo a propósito (RN-122). */
const COMBO_CON_POCO_MARGEN = "COMBO1";
/** En DUX, estas no son una marca: no sirven como propuesta. */
const MARCA_DE_RELLENO = /^(NACIONAL|SIN ?MARCA|VARIOS|GENERICO)$/;
const NOMBRE_DEL_DATO = { tela: "tela", marca: "marca", proveedor: "proveedor" } as const;

const compacto = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Levenshtein con transposición: "WOVISNI" y "WOVISINI" son la misma marca mal escrita. */
export function distancia(a: string, b: string): number {
  const filas = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) filas[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let mejor = Math.min(filas[i - 1]![j]! + 1, filas[i]![j - 1]! + 1, filas[i - 1]![j - 1]! + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        mejor = Math.min(mejor, filas[i - 2]![j - 2]! + 1);
      filas[i]![j] = mejor;
    }
  }
  return filas[a.length]![b.length]!;
}

/** "Dlirio" y "DELIRIO", o "Le victoria" y "LE VICTORIA S": otra escritura no es otra marca. */
export function esLaMismaMarca(a: string, b: string): boolean {
  const [x, y] = [compacto(a), compacto(b)];
  return x === y || x.includes(y) || y.includes(x) || distancia(x, y) <= 2;
}

const conjuncion = (partes: string[]) =>
  partes.length < 2 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;

const fechaLeible = (fecha: string) => fecha.split("-").toReversed().join("/");

/** Solo a una letra de distancia: a dos, el parecido entre códigos es casualidad. Si hay varios, es una duda. */
function sugerenciasPara(raiz: string, codigos: string[]): string[] {
  const cercanos = codigos.filter((codigo) => distancia(raiz, codigo) <= 1);
  return cercanos.length === 1 ? cercanos : [];
}

export function casosDeRevision({
  armado,
  evaluaciones,
  espejo,
  historicosDecididos,
}: {
  armado: CatalogoArmado;
  evaluaciones: ReadonlyMap<string, EvaluacionDelProducto>;
  espejo: ReadonlyMap<string, CodigoDelEspejo>;
  /** Los que una persona ya confirmó, o dijo que no son. */
  historicosDecididos: ReadonlySet<string>;
}): CasoDeRevision[] {
  const casos: CasoDeRevision[] = [];

  const delProducto = (
    block: BloqueDeRevision,
    producto: ProductoArmado,
    fixIn: FuenteDeCorreccion,
    description: string,
    details: CasoDeRevision["details"] = {},
  ) => {
    const { prioridad, ranking } = evaluaciones.get(producto.codigo)!;
    casos.push({
      block,
      key: producto.codigo,
      baseCode: producto.codigo,
      priority: prioridad,
      salesRank: ranking,
      description,
      fixIn,
      sheetRow: producto.filaDelSheet,
      details,
    });
  };

  const deUnaFila = (key: string, sheetRow: number | null, description: string) =>
    casos.push({
      block: "codigos",
      key,
      baseCode: null,
      priority: null,
      salesRank: null,
      description,
      fixIn: "sheet",
      sheetRow,
      details: {},
    });

  for (const { codigo, filas } of armado.codigosRepetidos) {
    deUnaFila(`repetido:${codigo}`, filas[0] ?? null, `${codigo} está en las filas ${conjuncion(filas.map(String))}.`);
  }
  for (const { fila, codigo } of armado.filasConPackViejo) {
    deUnaFila(`pack_viejo:${fila}`, fila, `${codigo} es un pack viejo: falta el código nuevo en sku_nuevo.`);
  }
  for (const fila of armado.filasSinCodigo) {
    deUnaFila(`sin_codigo:${fila}`, fila, "Tiene datos, pero no tiene SKU.");
  }

  for (const producto of armado.productos) {
    const evaluacion = evaluaciones.get(producto.codigo)!;
    if (evaluacion.estado === "historico") {
      if (!historicosDecididos.has(producto.codigo)) {
        delProducto(
          "historicos",
          producto,
          "app",
          evaluacion.ultimaVenta
            ? `Sin stock. Última venta: ${fechaLeible(evaluacion.ultimaVenta)}.`
            : "Sin stock y sin ventas en el último año.",
        );
      }
      continue;
    }
    if (evaluacion.estado !== "activo") continue;

    const { enSheet, enDux, fotos, tieneFotoEnDux, problemasDeEnvio, enDuxDice, faltan } = {
      ...producto,
      faltan: new Set(evaluacion.faltantes.map(({ dato }) => dato)),
    };

    if (!enSheet) delProducto("sin_fila", producto, "sheet", "Está en DUX y se puede vender, pero no tiene fila.");
    else if (problemasDeEnvio.length > 0) {
      delProducto(
        "envio",
        producto,
        "sheet",
        `${conjuncion(problemasDeEnvio)}.`.replace(/^./, (l) => l.toUpperCase()),
      );
    }

    const bulto = evaluacion.codigoDelBulto ? espejo.get(evaluacion.codigoDelBulto) : undefined;
    const noCierra = [
      enDux && !evaluacion.codigoDelBulto && "No tiene el bulto de su rubro en DUX.",
      evaluacion.codigoDelBulto && faltan.has("precio") && `${evaluacion.codigoDelBulto} no tiene precio mayorista.`,
      faltan.has("costo") && "No tiene costo.",
      bulto &&
        bulto.precioCentavos > 0 &&
        bulto.costoCentavos >= bulto.precioCentavos &&
        producto.codigo !== COMBO_CON_POCO_MARGEN &&
        `El costo de ${evaluacion.codigoDelBulto} no es menor que su precio.`,
    ].filter((texto): texto is string => Boolean(texto));
    if (noCierra.length > 0) delProducto("precio_costo", producto, "dux", noCierra.join(" "));

    if (faltan.has("foto")) delProducto("sin_foto", producto, "drive", "No tiene fotos en Drive ni en DUX.");
    else if (enSheet && fotos.length === 0 && tieneFotoEnDux) {
      delProducto("foto_solo_dux", producto, "drive", "No tiene fotos en Drive: se ve la de DUX.");
    }

    if (enSheet && enDuxDice.rubro && producto.rubro && compacto(enDuxDice.rubro) !== compacto(producto.rubro)) {
      delProducto("rubro_distinto", producto, "sheet", `El Sheet dice ${producto.rubro} y DUX, ${enDuxDice.rubro}.`);
    }

    const { marca, proveedor } = producto;
    if (marca.valor && enDuxDice.marca && !esLaMismaMarca(marca.valor, enDuxDice.marca)) {
      delProducto("marca_distinta", producto, "sheet", `El Sheet dice ${marca.valor} y DUX, ${enDuxDice.marca}.`);
    }

    if (!enSheet) continue;
    const pendientes = (["tela", "marca", "proveedor"] as const).filter((dato) =>
      evaluacion.faltantes.some((faltante) => faltante.dato === dato && faltante.situacion === "falta"),
    );
    if (pendientes.length === 0) continue;
    // Si el Sheet está vacío, se propone lo de DUX (`06` §6.2).
    const marcaEnDux =
      marca.situacion === "falta" && enDuxDice.marca && !MARCA_DE_RELLENO.test(compacto(enDuxDice.marca))
        ? enDuxDice.marca
        : null;
    const proveedorEnDux = proveedor.situacion === "falta" ? enDuxDice.proveedor : null;
    const propuestas = [marcaEnDux && `marca ${marcaEnDux}`, proveedorEnDux && `proveedor ${proveedorEnDux}`].filter(
      (texto): texto is string => Boolean(texto),
    );
    delProducto(
      "atributos",
      producto,
      "sheet",
      `Falta ${conjuncion(pendientes.map((dato) => NOMBRE_DEL_DATO[dato]))}.${propuestas.length > 0 ? ` DUX dice: ${conjuncion(propuestas)}.` : ""}`,
    );
  }

  const codigos = armado.productos.map(({ codigo }) => codigo);
  for (const { driveId, nombre, raiz } of armado.fotosSueltas) {
    casos.push({
      block: "fotos_sueltas",
      key: driveId,
      baseCode: null,
      priority: null,
      salesRank: null,
      description: `${nombre}: no hay ningún producto con ese código.`,
      fixIn: "app",
      sheetRow: null,
      details: { nombre, sugerencias: sugerenciasPara(raiz, codigos) },
    });
  }

  return casos;
}
