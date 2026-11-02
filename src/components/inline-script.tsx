/**
 * Script que se ejecuta durante el parseo del HTML (antes del primer paint).
 * En el cliente se marca como text/plain para que React no lo re-ejecute ni
 * advierta; ver la guía "Preventing flash before hydration" de Next.js.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
