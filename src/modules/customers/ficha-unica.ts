/**
 * La ficha única (RF-M12-01): el teléfono es la identidad de la clienta (RN-90), así
 * que las fichas de DUX con el mismo teléfono son una sola persona. Sin base ni red.
 *
 * Una ficha sin teléfono no identifica a nadie: ahí cae la venta del local a consumidor
 * final. No hace falta una regla para ella, y no se inventa a quién atribuirla.
 */

export type FichaDux = {
  duxId: number;
  name: string;
  firstName: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  province: string | null;
  city: string | null;
  /** "2026-10-09"; null si no tiene ficha creada con fecha. */
  creadaEl: string | null;
  /** "2026-11-03"; null si no compró en lo que está leído. */
  ultimaCompra: string | null;
};

export type ClientaUnida = {
  normalizedPhone: string;
  name: string;
  firstName: string | null;
  phone: string;
  email: string | null;
  province: string | null;
  city: string | null;
  /** Cuántas fichas de DUX son esta clienta. */
  duxRecords: number;
};

const masNueva = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");

/** Primero la que compró hace menos: es el dato más vigente de la persona. */
function porVigencia(a: FichaDux, b: FichaDux): number {
  return masNueva(a.ultimaCompra, b.ultimaCompra) || masNueva(a.creadaEl, b.creadaEl) || b.duxId - a.duxId;
}

export function unirFichas(fichas: FichaDux[]): { clientas: ClientaUnida[]; sinTelefono: number } {
  const porTelefono = new Map<string, FichaDux[]>();
  let sinTelefono = 0;
  for (const ficha of fichas) {
    if (!ficha.normalizedPhone) {
      sinTelefono += 1;
      continue;
    }
    porTelefono.set(ficha.normalizedPhone, [...(porTelefono.get(ficha.normalizedPhone) ?? []), ficha]);
  }

  const clientas = [...porTelefono].map(([normalizedPhone, grupo]) => {
    const [vigente, ...resto] = grupo.toSorted(porVigencia) as [FichaDux, ...FichaDux[]];
    const conDato = (campo: "email" | "province" | "city") =>
      vigente[campo] ?? resto.find((ficha) => ficha[campo])?.[campo] ?? null;
    return {
      normalizedPhone,
      name: vigente.name,
      // Del nombre, solo la ficha vigente: si dos personas comparten el teléfono, no se saluda a una con el de la otra.
      firstName: vigente.firstName,
      phone: vigente.phone ?? normalizedPhone,
      email: conDato("email"),
      province: conDato("province"),
      city: conDato("city"),
      duxRecords: grupo.length,
    };
  });
  return { clientas, sinTelefono };
}
