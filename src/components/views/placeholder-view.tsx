import { Download, Plus, SquareDashed } from "lucide-react";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { findRoute } from "@/lib/navigation";

/**
 * Pantalla de ejemplo para un item de la navegación. Toma título, ícono y
 * descripción de config/navigation.ts. Reemplazala por la vista real.
 */
export function PlaceholderView({ href }: { href: string }) {
  const match = findRoute(href);
  if (!match) notFound();

  const { link, group, section } = match;
  const Icon = link.icon ?? group?.icon ?? SquareDashed;
  const file = `src/app/(dashboard)${href}/page.tsx`;

  return (
    <>
      <PageHeader
        eyebrow={group?.title ?? section?.label ?? "Cuenta"}
        title={link.title}
        description={link.description}
        actions={
          <>
            <Button variant="outline">
              <Download />
              Exportar
            </Button>
            <Button>
              <Plus />
              Nuevo
            </Button>
          </>
        }
      />
      <PageBody>
        <Card>
          <CardHeader className="items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle>Vista de {link.title}</CardTitle>
                <CardDescription>Contenido de ejemplo para esta pantalla.</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono">
              {href}
            </Badge>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-border-strong bg-canvas/60 px-6 py-12 text-center">
              <div className="flex max-w-md flex-col items-center gap-2">
                <p className="text-sm font-medium">Esta pantalla está lista para construir</p>
                <p className="text-pretty text-sm text-muted-foreground">
                  Reemplazá este contenido editando
                </p>
                <div className="flex max-w-full items-center gap-1 rounded-md border border-border bg-surface py-0.5 pl-2 pr-0.5">
                  <code className="font-mono text-xs text-foreground wrap-anywhere">
                    {file}
                  </code>
                  <CopyButton
                    value={file}
                    label="Copiar ruta del archivo"
                    successMessage="Ruta copiada"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
