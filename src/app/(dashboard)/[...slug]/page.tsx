import { notFound } from "next/navigation";

/** Solo muestra el 404: no hay pantalla que validar, y next dev avisaría que no pudo hacerlo. */
export const instant = false;

/** Cualquier ruta sin page.tsx muestra el 404 dentro del dashboard. */
export default function UnknownRoute() {
  notFound();
}
