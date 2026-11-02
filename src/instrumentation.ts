/** Next lo ejecuta una vez al levantar el servidor. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Si falta una variable o tiene mal formato, la app no arranca y el error dice cuál y qué hacer.
    const { validateEnv } = await import("./env");
    validateEnv();
  }
}
