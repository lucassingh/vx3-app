/**
 * Datos de referencia de la base (roles, permisos, reglas por defecto): versionados
 * e idempotentes, así se puede correr las veces que haga falta (tecnica_doc/tecnica.md §5).
 * Los primeros llegan con usuarios y roles, en la fase 1.2.
 *
 * Uso: npm run db:seed
 */
const seeders: { nombre: string; correr: () => Promise<number> }[] = [];

async function main() {
  let total = 0;
  for (const seeder of seeders) {
    const cantidad = await seeder.correr();
    total += cantidad;
    console.log(`${seeder.nombre}: ${cantidad}`);
  }
  console.log(seeders.length ? `Listo: ${total} registros de referencia.` : "No hay datos de referencia todavía.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
