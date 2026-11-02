import { cn } from "@/lib/utils";

/**
 * Tabla con el estilo del dashboard. Pensada para ir dentro de una <Card>:
 * la primera y la última columna se alinean con el padding de la card.
 */
export function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    // relative: contiene los textos sr-only (absolutos) dentro del scroll horizontal.
    <div className={cn("relative w-full overflow-x-auto", containerClassName)}>
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "border-y border-border bg-muted/60 text-left text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn(
        "divide-y divide-border [&>tr]:transition-colors [&>tr:hover]:bg-muted/40",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow(props: React.ComponentProps<"tr">) {
  return <tr {...props} />;
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("px-3 py-2.5 font-medium first:pl-5 last:pr-5", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-3 py-3 first:pl-5 last:pr-5", className)} {...props} />;
}
