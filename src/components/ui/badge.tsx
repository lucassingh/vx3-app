import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        outline: "border-border bg-surface text-foreground",
        primary: "border-transparent bg-primary/10 text-foreground",
        accent: "border-transparent bg-accent/10 text-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/12 text-warning",
        danger: "border-transparent bg-danger/10 text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

const dotColor = {
  neutral: "bg-muted-foreground",
  outline: "bg-foreground",
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Punto de color antes del texto: refuerza el estado sin depender solo del color. */
    dot?: boolean;
  };

export function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", dotColor[variant ?? "neutral"])}
        />
      )}
      {children}
    </span>
  );
}
