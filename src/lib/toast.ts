/**
 * Avisos (toasts) para confirmar las acciones del usuario. Importá siempre
 * desde acá y no desde "sonner": si algún día cambia la librería, se cambia
 * en un solo lugar.
 *
 *   toast.success("Cambios guardados");
 *   toast.error("No se pudo guardar", {
 *     description: "Revisá la conexión.",
 *     action: { label: "Reintentar", onClick: save },
 *   });
 *   toast.promise(api.records.create(data), {
 *     loading: "Guardando…",
 *     success: "Registro creado",
 *     error: "No se pudo crear el registro",
 *   });
 *
 * El contenedor (<Toaster />) ya está montado en el root layout.
 */
export { toast } from "sonner";
