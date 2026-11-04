/**
 * Aparte y sin dependencias porque lo usan los workflows en su propio cuerpo, que corre
 * sin Node: importarlo de `index.ts` arrastraría Prisma, pino y crypto, y no compilaría.
 */
export const POR_PAGINA_DUX = 50;
