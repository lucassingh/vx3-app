import { PageHeader } from "@/components/layout/page-header";
import { findRoute } from "@/lib/navigation";

/** Header de la pantalla con título, grupo y bajada tomados de config/navigation.ts. */
export function RouteHeader({ href, actions }: { href: string; actions?: React.ReactNode }) {
  const match = findRoute(href);
  return (
    <PageHeader
      eyebrow={match?.group?.title ?? match?.section?.label}
      title={match?.link.title ?? ""}
      description={match?.link.description}
      actions={actions}
    />
  );
}
