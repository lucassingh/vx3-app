/**
 * Estado en memoria de la API simulada, separado por dominio.
 *
 *   const getPedidos = defineStore("pedidos", (now) => crearPedidos(now));
 *   getPedidos().push(…);
 *
 * Se guarda en globalThis para que el render de Server Components y el Route
 * Handler compartan el mismo estado (Next puede cargar el módulo dos veces).
 * Vive en memoria: se reinicia al reiniciar el servidor.
 */

type Factory = (now: number) => unknown;

const factories = new Map<string, Factory>();
const store = globalThis as typeof globalThis & { __mockDb?: Map<string, unknown> };

export function defineStore<T>(name: string, create: (now: number) => T) {
  factories.set(name, create);
  return (): T => {
    store.__mockDb ??= new Map();
    if (!store.__mockDb.has(name)) store.__mockDb.set(name, create(Date.now()));
    return store.__mockDb.get(name) as T;
  };
}

/** Vuelve a los datos semilla de todos los dominios (útil en tests). */
export function resetDb(now = Date.now()) {
  store.__mockDb = new Map();
  for (const [name, create] of factories) store.__mockDb.set(name, create(now));
}
