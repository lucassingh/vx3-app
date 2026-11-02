import { PageSkeleton } from "@/components/views/skeletons";

/**
 * Se muestra mientras carga una pantalla que pide datos en su page.tsx (fuera
 * de un <AsyncWidget>). Las pantallas estáticas aparecen al instante.
 */
export default function Loading() {
  return <PageSkeleton />;
}
