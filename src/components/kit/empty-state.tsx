import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vacío dentro de una card o una tabla. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
