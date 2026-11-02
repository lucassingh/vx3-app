import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn, getInitials } from "@/lib/utils";

type AvatarProps = {
  name: string;
  src?: string;
  className?: string;
};

export function Avatar({ name, src, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex size-8 shrink-0 select-none overflow-hidden rounded-full bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="size-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center text-xs font-semibold tracking-wide">
        {getInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
