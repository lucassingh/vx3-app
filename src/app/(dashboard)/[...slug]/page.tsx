import { notFound } from "next/navigation";

/** Cualquier ruta sin page.tsx muestra el 404 dentro del dashboard. */
export default function UnknownRoute() {
  notFound();
}
