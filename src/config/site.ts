import type { ThemePreference } from "@/lib/preferences";

/**
 * Identidad del producto. Junto con theme.css y navigation.ts es todo lo que
 * hay que tocar para adaptar el dashboard a un cliente nuevo.
 */
export const siteConfig = {
  name: "VX3",
  tagline: "Ventas por Tres",
  description: "Gestión integral de VX3: catálogo, ventas, pedidos, envíos y cobros en un solo lugar.",
  /** Ruta a un logo en /public (ej. "/logo.svg"). Si es null se usa un monograma. */
  logo: "/logo.svg" as string | null,
  lang: "es",
  locale: "es-AR",
  version: "v0.1.0",
  /** Tema inicial para visitantes que todavía no eligieron uno. */
  defaultTheme: "system" as ThemePreference,
};
