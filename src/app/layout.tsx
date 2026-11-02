import type { Metadata, Viewport } from "next";
import { PreferencesSync } from "@/components/layout/preferences-sync";
import { Toaster } from "@/components/ui/toaster";
import { fontMono, fontSans } from "@/config/fonts";
import { siteConfig } from "@/config/site";
import { getPreferencesScript } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={siteConfig.lang}
      className={cn(fontSans.variable, fontMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica tema y estado del aside antes del primer paint. */}
        <script dangerouslySetInnerHTML={{ __html: getPreferencesScript() }} />
      </head>
      <body>
        <PreferencesSync />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
