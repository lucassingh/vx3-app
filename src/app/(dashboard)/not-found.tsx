import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageBody } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageBody className="grid min-h-[calc(100dvh-3.5rem)] place-items-center">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">
          La ruta no existe o todavía no tiene una vista. Si es un item nuevo del menú,
          creá su page.tsx dentro de src/app/(dashboard).
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft />
            Volver al inicio
          </Link>
        </Button>
      </div>
    </PageBody>
  );
}
