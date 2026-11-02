import { Geist, Geist_Mono } from "next/font/google";

/**
 * Tipografías del producto. Para cambiarlas, reemplazá los imports por otra
 * fuente de next/font y mantené los nombres de las variables CSS.
 */
export const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-brand-sans",
  display: "swap",
});

export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-brand-mono",
  display: "swap",
});
