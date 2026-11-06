/**
 * Aparte y sin dependencias porque lo usan los workflows en su propio cuerpo, que corre
 * sin Node: importarlo de `index.ts` arrastraría Prisma, pino y crypto, y no compilaría.
 */
export const POR_PAGINA_DUX = 50;

/** Todas las filas de un listado: hasta `hay_mas` falso o, si no viene, hasta una página incompleta. */
export async function todasLasPaginas<T>(
  leer: (offset: number) => Promise<{ datos: T[]; paginacion?: { hay_mas: boolean } }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let offset = 0; ; offset += POR_PAGINA_DUX) {
    const { datos, paginacion } = await leer(offset);
    filas.push(...datos);
    if (!(paginacion?.hay_mas ?? datos.length === POR_PAGINA_DUX)) return filas;
  }
}
