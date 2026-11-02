import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-border-strong bg-surface text-sm text-foreground shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/20";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "min-h-20 px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

/** Select nativo con el estilo de los inputs: accesible y sin JS. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className={cn(fieldClass, "h-9 cursor-pointer appearance-none pl-3 pr-9")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
