/**
 * Escribe un `.xls`, el único formato que DUX importa: un `.xlsx` lo lee sin columnas.
 *
 * Sale idéntico, byte por byte, al que escribe `xlwt`, que es la librería con la que el Hub
 * validó las importaciones contra DUX. No hay forma de probar un archivo contra DUX sin crear
 * productos que después no se pueden borrar: la garantía es esa, y la prueban los archivos de
 * `src/integrations/dux/fixtures/hub`, generados con el código del Hub. Por eso los tramos de
 * configuración van tal cual los escribe esa librería, en vez de armarse acá.
 */

/** Del comienzo hasta la lista de hojas: versión, fuentes, formatos y estilos. */
const GLOBALES = [
  "0908100000060500bb0dcc070000000006000000e1000200b004c10002000000e20000005c0070004e6f6e6520202020",
  "202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020",
  "202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020",
  "202020202020202042000200b0046101020000003d01020001009c0002000e0019000200000012000200000063000200",
  "0000130002000000af0102000000bc01020000004000020000008d00020000003d001200e0015a00cf3f4e2a38000000",
  "0000010058022200020000000e0002000100b70102000000da000200000031001500c8000000ff7f9001000000000100",
  "0500417269616c31001500c8000000ff7f90010000000001000500417269616c31001500c8000000ff7f900100000000",
  "01000500417269616c31001500c8000000ff7f90010000000001000500417269616c31001500c8000000ff7f90010000",
  "000001000500417269616c31001500c8000000ff7f90010000000001000500417269616c31001500c8000000ff7f9001",
  "0000000001000500417269616c1e040c00a40007000047656e6572616ce00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a400f5ff200000f40000000000",
  "000000c020e00014000600a400f5ff200000f40000000000000000c020e00014000600a4000100200000f80000000000",
  "000000c020e00014000700a4000100200000f80000000000000000c02093020400008000ff600102000100",
].join("");

/** El comienzo de la hoja. */
const HOJA_ANTES_DE_LAS_MEDIDAS = [
  "0908100000061000bb0dcc0700000000060000000d00020001000c00020064000f000200010011000200000010000800",
  "fca9f1d24d62503f5f0002000000800008000000000001000000250204000000ff0081000200010c",
].join("");

/** La configuración de impresión de la hoja. */
const HOJA_ANTES_DE_LAS_FILAS = [
  "2a00020000002b00020000008200020001001b00020000001a0002000000140005000200002650150005000200002646",
  "83000200010084000200000026000800333333333333d33f27000800333333333333d33f2800080085eb51b81e85e33f",
  "29000800ae47e17a14aed73fa10022000900640001000100010083002c012c019a9999999999b93f9a9999999999b93f",
  "0100120002000000dd0002000000190002000000630002000000130002000000",
].join("");

/** La ventana y el fin de la hoja. */
const HOJA_FINAL = ["3e021200b602000000004000000000000000000000000a000000"].join("");

const XF = 0x11;
const FILA_FINAL = "ff000000000000010f00";
const SECTOR = 512;
const BLOQUE_MINIMO = 0x1000;
/** Lo que entra en un registro. Más texto iría en registros de continuación, que un solo producto no necesita. */
const MAXIMO_DE_TEXTOS = 0x2020;

export type CeldaXls = string | number | null | undefined;

const desdeHex = (texto: string) => Buffer.from(texto, "hex");

function u16(...valores: number[]): Buffer {
  const buffer = Buffer.alloc(valores.length * 2);
  valores.forEach((valor, i) => buffer.writeUInt16LE(valor, i * 2));
  return buffer;
}

function u32(...valores: number[]): Buffer {
  const buffer = Buffer.alloc(valores.length * 4);
  valores.forEach((valor, i) => buffer.writeUInt32LE(valor >>> 0, i * 4));
  return buffer;
}

function registro(id: number, ...datos: Buffer[]): Buffer {
  const cuerpo = Buffer.concat(datos);
  return Buffer.concat([u16(id, cuerpo.length), cuerpo]);
}

/** Latin-1 si alcanza, como hace `xlwt`: un byte por letra. Si no, UTF-16. */
function texto(valor: string): { largo: number; bandera: number; bytes: Buffer } {
  const esLatin1 = [...valor].every((letra) => letra.codePointAt(0)! <= 0xff);
  const bytes = Buffer.from(valor, esLatin1 ? "latin1" : "utf16le");
  return { largo: esLatin1 ? valor.length : bytes.length / 2, bandera: esLatin1 ? 0 : 1, bytes };
}

/**
 * Un número en 30 bits, si se puede: entero, o entero al multiplicarlo por 100. Null si hay que
 * guardarlo entero. Es la codificación RK de Excel, en el orden en que la prueba `xlwt`.
 */
function aRk(numero: number): number | null {
  const limite = 0x20000000;
  if (numero >= -limite && numero < limite && Math.trunc(numero) === numero) return 2 | (numero << 2);
  const porCien = numero * 100;
  if (porCien >= -limite && porCien < limite) {
    const entero = Math.round(porCien);
    if (entero / 100 === numero) return 3 | (entero << 2);
  }
  return null;
}

function rk(valor: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(valor);
  return buffer;
}

function numeroEntero(fila: number, columna: number, numero: number): Buffer {
  const doble = Buffer.alloc(8);
  doble.writeDoubleLE(numero);
  return registro(0x0203, u16(fila, columna, XF), doble);
}

/** Los números seguidos van en un solo registro. */
function celdasDeLaFila(
  fila: number,
  celdas: readonly { columna: number; valor: string | number }[],
  indiceDe: (valor: string) => number,
): Buffer {
  const partes: Buffer[] = [];
  for (let i = 0; i < celdas.length;) {
    const { columna, valor } = celdas[i]!;
    if (typeof valor === "string") {
      partes.push(registro(0x00fd, u16(fila, columna, XF), u32(indiceDe(valor))));
      i += 1;
      continue;
    }
    const primero = aRk(valor);
    if (primero === null) {
      partes.push(numeroEntero(fila, columna, valor));
      i += 1;
      continue;
    }
    const grupo = [primero];
    let ultima = columna;
    let j = i + 1;
    let suelto: Buffer | null = null;
    for (; j < celdas.length; j++) {
      const siguiente = celdas[j]!;
      if (siguiente.columna !== ultima + 1 || typeof siguiente.valor === "string") break;
      const codificado = aRk(siguiente.valor);
      if (codificado === null) {
        suelto = numeroEntero(fila, siguiente.columna, siguiente.valor);
        j += 1;
        break;
      }
      grupo.push(codificado);
      ultima = siguiente.columna;
    }
    if (grupo.length === 1) partes.push(registro(0x027e, u16(fila, columna, XF), rk(primero)));
    else
      partes.push(
        registro(0x00bd, u16(fila, columna), ...grupo.flatMap((valorRk) => [u16(XF), rk(valorRk)]), u16(ultima)),
      );
    if (suelto) partes.push(suelto);
    i = j;
  }
  return Buffer.concat(partes);
}

function entradaDeDirectorio(nombre: string, tipo: number, hijo: number, inicio: number, tamano: number): Buffer {
  const entrada = Buffer.alloc(128);
  const conFin = Buffer.from(nombre ? `${nombre}\0` : "", "utf16le");
  conFin.copy(entrada);
  entrada.writeUInt16LE(conFin.length, 64);
  entrada[66] = tipo;
  entrada[67] = 1;
  entrada.writeInt32LE(-1, 68);
  entrada.writeInt32LE(-1, 72);
  entrada.writeInt32LE(hijo, 76);
  entrada.writeInt32LE(inicio, 116);
  entrada.writeUInt32LE(tamano, 120);
  return entrada;
}

/** El contenedor del archivo: la hoja de cálculo va adentro, en sectores de 512 bytes. */
function envolver(libro: Buffer): Uint8Array {
  const relleno = Buffer.alloc(BLOQUE_MINIMO - (libro.length % BLOQUE_MINIMO));
  const completo = Buffer.concat([libro, relleno]);
  const sectoresDelLibro = completo.length / SECTOR;

  let sectoresDeLaTabla = 0;
  let total = sectoresDelLibro + 1;
  while (total > 128 * sectoresDeLaTabla) {
    sectoresDeLaTabla += 1;
    total += 1;
  }
  if (sectoresDeLaTabla > 109) throw new Error("Demasiados datos para un .xls.");

  const tabla = new Int32Array(128 * sectoresDeLaTabla).fill(-1);
  for (let sector = 0; sector < sectoresDelLibro - 1; sector++) tabla[sector] = sector + 1;
  tabla[sectoresDelLibro - 1] = -2;
  for (let sector = 0; sector < sectoresDeLaTabla; sector++) tabla[sectoresDelLibro + sector] = -3;
  const sectorDelDirectorio = sectoresDelLibro + sectoresDeLaTabla;
  tabla[sectorDelDirectorio] = -2;

  const cabecera = Buffer.alloc(SECTOR, 0xff);
  Buffer.alloc(76).copy(cabecera);
  desdeHex("d0cf11e0a1b11ae1").copy(cabecera);
  u16(0x3e, 3, 0xfffe, 9, 6).copy(cabecera, 24);
  cabecera.writeUInt32LE(sectoresDeLaTabla, 44);
  cabecera.writeUInt32LE(sectorDelDirectorio, 48);
  cabecera.writeUInt32LE(BLOQUE_MINIMO, 56);
  cabecera.writeInt32LE(-2, 60);
  cabecera.writeInt32LE(-2, 68);
  for (let i = 0; i < sectoresDeLaTabla; i++) cabecera.writeUInt32LE(sectoresDelLibro + i, 76 + i * 4);

  return Buffer.concat([
    cabecera,
    completo,
    Buffer.from(tabla.buffer),
    entradaDeDirectorio("Root Entry", 5, 1, -2, 0),
    entradaDeDirectorio("Workbook", 2, -1, 0, completo.length),
    entradaDeDirectorio("", 0, -1, -2, 0),
    entradaDeDirectorio("", 0, -1, -2, 0),
  ]);
}

/**
 * Una hoja, con los títulos en la primera fila. Una celda vacía o null no se escribe: en DUX,
 * eso es lo que deja un producto fuera de una lista de precios.
 */
export function escribirXls(
  columnas: readonly string[],
  filas: readonly (readonly CeldaXls[])[],
  nombreDeHoja = "Hoja Principal",
): Uint8Array {
  const textos = new Map<string, number>();
  let usos = 0;
  const indiceDe = (valor: string) => {
    usos += 1;
    const conocido = textos.get(valor);
    if (conocido !== undefined) return conocido;
    textos.set(valor, textos.size);
    return textos.size - 1;
  };

  let ultimaColumna = -1;
  let ultimaFila = -1;
  const bloques: Buffer[] = [];
  [columnas as readonly CeldaXls[], ...filas].forEach((fila, indice) => {
    const celdas = fila.flatMap((valor, columna) =>
      valor === null || valor === undefined || valor === "" ? [] : [{ columna, valor }],
    );
    if (celdas.length === 0) return;
    const primera = celdas[0]!.columna;
    const ultima = celdas.at(-1)!.columna;
    ultimaColumna = Math.max(ultimaColumna, ultima);
    ultimaFila = indice;
    bloques.push(
      registro(0x0208, u16(indice, primera, ultima + 1), desdeHex(FILA_FINAL)),
      celdasDeLaFila(indice, celdas, indiceDe),
    );
  });

  const cuerpoDeTextos = Buffer.concat(
    [...textos.keys()].map((valor) => {
      const { largo, bandera, bytes } = texto(valor);
      return Buffer.concat([u16(largo), Buffer.from([bandera]), bytes]);
    }),
  );
  if (cuerpoDeTextos.length + 8 > MAXIMO_DE_TEXTOS) throw new Error("Demasiado texto para un .xls.");
  const tablaDeTextos = registro(0x00fc, u32(usos, textos.size), cuerpoDeTextos);

  const globales = desdeHex(GLOBALES);
  const nombre = texto(nombreDeHoja);
  const finDeGlobales = registro(0x000a);
  const largoDeLaLista = 4 + 8 + nombre.bytes.length;
  const inicioDeLaHoja = globales.length + largoDeLaLista + tablaDeTextos.length + finDeGlobales.length;
  const listaDeHojas = registro(
    0x0085,
    u32(inicioDeLaHoja),
    u16(0),
    Buffer.from([nombre.largo, nombre.bandera]),
    nombre.bytes,
  );

  return envolver(
    Buffer.concat([
      globales,
      listaDeHojas,
      tablaDeTextos,
      finDeGlobales,
      desdeHex(HOJA_ANTES_DE_LAS_MEDIDAS),
      registro(0x0200, u32(0, ultimaFila + 1), u16(0, ultimaColumna + 1, 0)),
      desdeHex(HOJA_ANTES_DE_LAS_FILAS),
      ...bloques,
      desdeHex(HOJA_FINAL),
    ]),
  );
}
