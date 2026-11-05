import { diasEntre, VALORES_DE_SEGMENTOS } from "./metricas";

/**
 * La secuencia de recompra de Elías (`proceso_comercial_doc/VX3_Secuencia_Recompra_Reformulada.md`
 * y `VX3_Reactivacion_Dormidas.md`): qué mensaje le toca a cada clienta y con qué texto. Sin
 * base ni red. La app no manda nada: lo escribe una persona, desde su WhatsApp.
 */

/** Se cambian acá hasta que llegue el editor de reglas (1.10). */
export const VALORES_DE_RECOMPRA = {
  contactosPorDia: 30,
  diasEntreMensajes: 7,
  diasDeCadaMensaje: { rapida: [7, 17, 27, 37], lenta: [7, 22, 37, 52] },
  rotacionRapidaHastaDias: 20,
  descansoAntesDeReactivarDias: 45,
  /** Quiénes reciben la reactivación: 2 dejaría afuera a las que compraron una sola vez (duda d33). */
  reactivacionMinimoCompras: 1,
  /** El mensaje personal: el 17 % de las dormidas con más margen, el mismo corte que la lista de Elías. */
  altoValorPorcentaje: 17,
  productoNuevoDias: 45,
  comboNuevoDias: 60,
  diasDeResultado: 14,
};

export type Rotacion = "rapida" | "lenta";
export type EtapaDeSecuencia = "m1" | "m2" | "m3" | "m4";
export type Etapa = EtapaDeSecuencia | "reactivacion" | "alto_valor";
export type EstadoDeContacto = "contactada" | "respondio" | "pospuesta";

export const ETAPA_LABEL: Record<Etapa, string> = {
  m1: "Mensaje 1 · cuidado",
  m2: "Mensaje 2 · información",
  m3: "Mensaje 3 · oportunidad",
  m4: "Mensaje 4 · cierre",
  reactivacion: "Reactivación",
  alto_valor: "Reactivación · alto valor",
};

const SECUENCIA: EtapaDeSecuencia[] = ["m1", "m2", "m3", "m4"];
const esDeSecuencia = (etapa: Etapa): etapa is EtapaDeSecuencia => (SECUENCIA as Etapa[]).includes(etapa);

export type ClientaEnSecuencia = {
  /** "2026-11-03" */
  ultimaCompra: string;
  compras: number;
  cicloDias: number | null;
  margen12mCentavos: number;
};

export type ContactoPrevio = {
  fecha: string;
  etapa: Etapa;
  variante: string;
  estado: EstadoDeContacto;
};

/** DUX no dice qué negocio es cada clienta. Con una sola compra, lenta: manda menos mensajes (aprobado por Elías). */
export function rotacionDe(cicloDias: number | null): Rotacion {
  return cicloDias !== null && cicloDias <= VALORES_DE_RECOMPRA.rotacionRapidaHastaDias ? "rapida" : "lenta";
}

/** Desde qué margen una dormida recibe el mensaje personal. Sin margen no hay alto valor. */
export function umbralAltoValor(margenesDeDormidas: number[]): number {
  const orden = margenesDeDormidas.toSorted((a, b) => b - a);
  const puesto = Math.ceil((orden.length * VALORES_DE_RECOMPRA.altoValorPorcentaje) / 100);
  return Math.max(orden[puesto - 1] ?? Number.POSITIVE_INFINITY, 1);
}

/**
 * Qué mensaje le toca hoy, o null si hoy no le toca ninguno. Una compra nueva arranca el
 * ciclo de cero: solo cuentan los contactos posteriores a la última compra.
 *
 * Quien todavía no recibió nada entra por el mensaje que corresponde a sus días, nunca por
 * la despedida; si ya pasó los días de dormida, directo a la reactivación. Como el tope
 * diario puede demorar un mensaje, después del primero no se saltea ninguno.
 */
export function etapaQueToca(
  clienta: ClientaEnSecuencia,
  contactos: ContactoPrevio[],
  umbral: number,
  hoy: string,
): Etapa | null {
  const delCiclo = contactos
    .filter(({ fecha, estado }) => fecha > clienta.ultimaCompra && estado !== "pospuesta")
    .toSorted((a, b) => a.fecha.localeCompare(b.fecha));
  if (delCiclo.some(({ estado }) => estado === "respondio")) return null;

  const ultimo = delCiclo.at(-1);
  if (ultimo && diasEntre(ultimo.fecha, hoy) < VALORES_DE_RECOMPRA.diasEntreMensajes) return null;

  const reactivar = (): Etapa | null => {
    if (clienta.compras < VALORES_DE_RECOMPRA.reactivacionMinimoCompras) return null;
    return clienta.margen12mCentavos >= umbral ? "alto_valor" : "reactivacion";
  };
  const dias = diasEntre(clienta.ultimaCompra, hoy);
  const tabla = VALORES_DE_RECOMPRA.diasDeCadaMensaje[rotacionDe(clienta.cicloDias)];

  if (!ultimo) {
    if (dias > VALORES_DE_SEGMENTOS.dormidaDias) return reactivar();
    const vencidos = tabla.filter((dia) => dia <= dias).length;
    return vencidos === 0 ? null : (SECUENCIA[Math.min(vencidos, 3) - 1] ?? null);
  }
  if (!esDeSecuencia(ultimo.etapa)) return null;
  if (ultimo.etapa === "m4") {
    return diasEntre(ultimo.fecha, hoy) >= VALORES_DE_RECOMPRA.descansoAntesDeReactivarDias ? reactivar() : null;
  }
  const siguiente = SECUENCIA.indexOf(ultimo.etapa) + 1;
  return dias >= (tabla[siguiente] ?? Number.POSITIVE_INFINITY) ? (SECUENCIA[siguiente] ?? null) : null;
}

/* ---- Los textos ------------------------------------------------------------- */

/**
 * Lo que los textos necesitan saber. Todo sale de la base y solo trae lo que tiene un bulto
 * en stock (RN-75): lo que el documento pide actualizar a mano cada 2 a 4 semanas, acá se
 * mantiene solo. Null: esa variante no se puede armar para esta clienta.
 */
export type DatosDelMensaje = {
  nombre: string | null;
  /** Lo más vendido de la semana. */
  categorias: string[];
  /** Algo recién dado de alta, parecido a lo que compró. */
  productoNuevo: string | null;
  /** De qué es un combo recién dado de alta. */
  comboNuevo: string | null;
  /** Algo que compró y se está por agotar: el texto dice que quedan pocas unidades. */
  productoPorAgotarse: string | null;
};

type Plantilla = {
  id: string;
  necesita?: "categorias" | "productoNuevo" | "comboNuevo" | "productoPorAgotarse";
  texto: string;
};

/**
 * Los textos de Elías, tal cual (RN-74). Las variantes por zona del mensaje 2 esperan al
 * cotizador (2.1), y la de fechas comerciales del mensaje 3, a un calendario.
 */
const PLANTILLAS: Record<Etapa, Plantilla[]> = {
  m1: [
    { id: "a", texto: "Hola {nombre}, cómo te fue con el pedido? Llegó todo bien?" },
    { id: "b", texto: "{Nombre}, quería saber si te llegó todo en orden. Cualquier cosa que necesites decime." },
    { id: "c", texto: "Hola {nombre}! Pudiste ver las prendas? Espero que te hayan gustado." },
  ],
  m2: [
    {
      id: "a",
      necesita: "categorias",
      texto:
        "{Nombre}, te cuento que esta semana se viene moviendo mucho {categoria}. Varias clientas que tenían lo mismo que vos nos están reponiendo antes de quedarse sin stock. Si querés ir viendo opciones, avisame.",
    },
    {
      id: "b",
      necesita: "productoNuevo",
      texto:
        "Hola {nombre}! Nos llegó {productoNuevo} y me acordé que la vez pasada habías llevado algo parecido. Si te interesa te muestro lo que entró.",
    },
  ],
  m3: [
    {
      id: "a",
      necesita: "comboNuevo",
      texto:
        "{Nombre}, armamos un combo nuevo de {comboNuevo} que está saliendo muy bien. Ya viene listo para revender, no tenés que elegir producto por producto. Si querés te paso qué incluye y el precio.",
    },
    {
      id: "b",
      necesita: "productoPorAgotarse",
      texto:
        "Hola {nombre}, te escribo porque estamos reponiendo {productoPorAgotarse} y quedan pocas unidades en algunos talles. Si necesitás reponer antes de que se complique, avisame y te lo separo.",
    },
    {
      id: "c",
      necesita: "categorias",
      texto:
        "{Nombre}, esta semana varias clientas nos preguntaron por {categoria}. Es lo que más se está pidiendo ahora. Si querés sumarlo a tu stock te cuento precios y disponibilidad.",
    },
  ],
  m4: [
    {
      id: "a",
      texto:
        "Hola {nombre}, no te quiero llenar de mensajes. Cuando necesites reponer, ya sabés que acá estamos. Escribime cuando quieras y lo vemos juntos.",
    },
    {
      id: "b",
      texto:
        "{Nombre}, este es el último mensaje que te mando por ahora. Cualquier día que necesites mercadería, mandame un mensaje y te atendemos.",
    },
    {
      id: "c",
      texto:
        "Hola {nombre}, te dejo tranquila por ahora. Cuando quieras ver novedades o reponer algo, acá estamos de lunes a sábado.",
    },
  ],
  reactivacion: [
    {
      id: "a",
      texto:
        "Hola {nombre}! Hace un tiempo que no te veo pedir — ¿cómo veniste con el stock últimamente?\nEstamos con bastante movimiento de temporada y quería avisarte antes de que se complique, por si te sirve reponer algo. Contame y vemos qué necesitás.",
    },
    {
      id: "b",
      texto:
        "Hola {nombre}, ¿cómo andás? Te escribo porque hace unas semanas que no sabemos nada y quería retomar el contacto.\nSi estás necesitando reponer stock, decime y te separo lo que te sirva — sin apuro, cuando quieras.",
    },
  ],
  alto_valor: [
    {
      id: "a",
      texto:
        "Hola {nombre}! Soy Elias de Ventas Por Tres. Hace rato que no hablamos y quería escribirte yo directamente — te tengo entre los clientes que más nos acompañaron y quería saber cómo veniste, si seguís con el rubro y si hay algo en lo que te pueda ayudar a reponer.",
    },
  ],
};

/** El mismo número para la misma clienta en el mismo ciclo: el texto no cambia al recargar. */
function numeroDe(semilla: string): number {
  let numero = 7;
  for (const letra of semilla) numero = (numero * 31 + letra.charCodeAt(0)) >>> 0;
  return numero;
}

/** Elige un elemento de la lista, siempre el mismo para la misma semilla: así no reciben todas lo mismo. */
export function elegir<T>(lista: T[], semilla: string): T | undefined {
  return lista[numeroDe(semilla) % lista.length];
}

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "MARIA JOSE" → "Maria". Sin nombre de pila queda sin completar, y la pantalla no deja mandarlo así. */
function saludo(nombre: string | null): string | null {
  const primero = nombre?.trim().split(/\s+/)[0]?.toLowerCase();
  return primero ? conMayuscula(primero) : null;
}

/**
 * Las variantes rotan entre clientas, y una clienta no repite la que recibió la última vez
 * (RN-74). Si a una etapa no le queda ninguna con datos, sale la primera con el dato por
 * completar: es preferible a inventarlo.
 */
export function armarMensaje(
  etapa: Etapa,
  datos: DatosDelMensaje,
  semilla: string,
  ultimaVariante: string | null = null,
): { variante: string; texto: string } {
  const plantillas = PLANTILLAS[etapa];
  const posibles = plantillas.filter(({ necesita }) => {
    if (!necesita) return true;
    return necesita === "categorias" ? datos.categorias.length > 0 : datos[necesita] !== null;
  });
  const sinRepetir = posibles.filter(({ id }) => id !== ultimaVariante);
  const opciones = sinRepetir.length > 0 ? sinRepetir : posibles;
  const plantilla = elegir(opciones, semilla) ?? (plantillas[0] as Plantilla);

  const nombre = saludo(datos.nombre);
  const texto = plantilla.texto
    .replaceAll("{nombre}", nombre ?? "[nombre]")
    .replaceAll("{Nombre}", nombre ?? "[Nombre]")
    .replaceAll("{categoria}", elegir(datos.categorias, semilla) ?? "[categoría]")
    .replaceAll("{productoNuevo}", datos.productoNuevo ?? "[producto nuevo]")
    .replaceAll("{comboNuevo}", datos.comboNuevo ?? "[categoría]")
    .replaceAll("{productoPorAgotarse}", datos.productoPorAgotarse ?? "[producto]");
  return { variante: plantilla.id, texto };
}

/** Lo que quedó sin completar: mientras haya algo entre corchetes, el mensaje no se puede mandar. */
export const faltaCompletar = (mensaje: string) => /\[[^\]]+\]/.test(mensaje);

/* ---- Cómo se nombran las cosas en un mensaje ---------------------------------- */

const RUBRO_EN_MENSAJE: Record<string, string> = {
  MEDIAS: "medias",
  "MEDIAS DEPORTIVAS": "medias deportivas",
  LESS: "less",
  CORPIÑOS: "corpiños",
  "CONJUNTOS DE LENCERIA": "conjuntos de lencería",
  VEDETINA: "vedetinas",
  INVIERNO: "artículos de invierno",
  NIÑOS: "ropa interior de niños",
  UNIVERSALES: "universales",
  PIJAMA: "pijamas",
  HOMBRE: "boxers de hombre",
  "CONJUNTO DEPORTIVO": "conjuntos deportivos",
  DEPORTIVO: "ropa deportiva",
  CULOTES: "culotes",
  MALLAS: "mallas",
  "BOXER MUJER": "boxers de mujer",
  BODY: "bodys",
  "REDUCTORES/ FAJAS": "reductores y fajas",
  CORSET: "corsets",
  LENCERIA: "lencería",
};

/** Lo que no se le puede ofrecer a nadie como categoría. */
const RUBROS_SIN_MENSAJE = new Set(["COMBOS", "ENVIOS Y EMBALAJE", "CONSUMIDOR FINAL", "Sin rubro"]);

export function rubroEnMensaje(rubro: string | null): string | null {
  if (!rubro || RUBROS_SIN_MENSAJE.has(rubro)) return null;
  return RUBRO_EN_MENSAJE[rubro] ?? rubro.toLowerCase();
}

/** "LESS LISA AMORARMA - CURVA DE TALLES L A 2XL - UNIDAD" → "less lisa amorarma". */
export function productoEnMensaje(nombre: string): string {
  return (nombre.split(/\s*-\s+|\s+-\s*|\s*\(|\s+CURVA\b|\s+TALLES?\b/i)[0] ?? nombre).trim().toLowerCase();
}

/* ---- Resultados --------------------------------------------------------------- */

export type CompraDeResultado = {
  clienta: string;
  id: number;
  fecha: string;
  totalCentavos: number;
  margenCentavos: number;
};

/**
 * "Volvieron a comprar": clientas contactadas con una compra en los 14 días siguientes al
 * mensaje. Es un conteo, no un efecto: algunas iban a comprar igual. Cada compra cuenta una
 * sola vez, aunque le hayan escrito dos veces.
 */
export function resultadosDeContactos(
  contactos: { clienta: string; fecha: string }[],
  compras: CompraDeResultado[],
): { contactadas: number; compraron: number; ventasCentavos: number; margenCentavos: number } {
  const atribuidas = compras.filter(({ clienta, fecha }) =>
    contactos.some((contacto) => {
      if (contacto.clienta !== clienta) return false;
      const dias = diasEntre(contacto.fecha, fecha);
      return dias > 0 && dias <= VALORES_DE_RECOMPRA.diasDeResultado;
    }),
  );
  return {
    contactadas: new Set(contactos.map(({ clienta }) => clienta)).size,
    compraron: new Set(atribuidas.map(({ clienta }) => clienta)).size,
    ventasCentavos: atribuidas.reduce((suma, { totalCentavos }) => suma + totalCentavos, 0),
    margenCentavos: atribuidas.reduce((suma, { margenCentavos }) => suma + margenCentavos, 0),
  };
}
