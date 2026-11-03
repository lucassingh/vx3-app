import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageBody } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/modules/platform/auth/session";
import { ROLE_INFO } from "@/modules/platform/permissions";

export const metadata: Metadata = { title: "Sin permiso" };

/** Adonde lleva requirePageAccess cuando el rol no puede ver esa pantalla. */
export default async function SinPermisoPage() {
  const user = await requireUser();

  return (
    <PageBody>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <ShieldOff aria-hidden className="size-6" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Esta pantalla no es para tu rol</h1>
        <p className="text-sm text-muted-foreground">
          Entraste como {ROLE_INFO[user.role].nombre}. Si necesitás verla, pedile a un admin que te cambie el rol en
          Configuración → Usuarios y roles.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </PageBody>
  );
}
