/**
 * Semilla compartida de la API simulada: el núcleo de entidades que cruzan
 * todos los módulos (productos, clientas, anuncios, pedidos, equipo). Cada
 * dominio de src/mocks/domains arma sus respuestas a partir de acá, así una
 * clienta o un pedido es el mismo en todas las pantallas.
 */
export * from "./anuncios";
export * from "./clientas";
export * from "./equipo";
export * from "./pedidos";
export * from "./productos";
export * from "./time";
