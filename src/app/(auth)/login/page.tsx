import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[30rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent)] opacity-[0.12]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="size-11 rounded-xl text-lg" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Ingresá a {siteConfig.name}
            </h1>
            <p className="text-sm text-muted-foreground">{siteConfig.tagline}</p>
          </div>
        </div>

        <Card className="p-6">
          <LoginForm />
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acceso exclusivo para el equipo de {siteConfig.name}.
        </p>
      </div>
    </main>
  );
}
