import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-snappy active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.1)] hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        outline:
          "border border-border-strong bg-surface text-foreground shadow-card hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-3.5",
        lg: "h-10 px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza el hijo (ej. un <Link>) con los estilos del botón. */
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
