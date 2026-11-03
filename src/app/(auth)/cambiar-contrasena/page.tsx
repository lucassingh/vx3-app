import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { SkeletonText } from "@/components/views/skeletons";
import { primerNombre } from "@/lib/format";
import { getSessionUser } from "@/modules/platform/auth/session";
import { FirstPasswordForm } from "./first-password-form";

export const metadata: Metadata = { title: "Elegí tu contraseña" };

/** Primer ingreso con una contraseña temporal (la dio un admin): hay que cambiarla para seguir. */
export default function CambiarContrasenaPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="size-11 rounded-xl text-lg" />
          <h1 className="text-xl font-semibold tracking-tight">Elegí tu contraseña</h1>
        </div>
        <Card className="p-6">
          <Suspense fallback={<SkeletonText lines={6} />}>
            <Contenido />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}

async function Contenido() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground">
        Hola, {primerNombre(user.name)}. Entraste con una contraseña temporal: cambiala por una tuya para seguir. La
        actual es la que te pasaron.
      </p>
      <FirstPasswordForm />
    </>
  );
}
