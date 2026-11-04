import { v7 as uuidv7 } from "uuid";

/**
 * ID nuevo para cualquier registro: uuid v7, generado en la app. Ordena por fecha
 * de creación, no expone secuencias y no depende de la versión de Postgres
 * (tecnica_doc/tecnica.md §5).
 */
export function newId(): string {
  return uuidv7();
}
