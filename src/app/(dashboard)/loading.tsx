import { PageSkeleton } from "@/components/views/skeletons";

/**
 * Se muestra mientras una pantalla espera la sesión o pide datos en su page.tsx
 * (fuera de un <AsyncWidget>). Cada pantalla lo reexporta en su propia carpeta.
 */
export default function Loading() {
  return <PageSkeleton />;
}
