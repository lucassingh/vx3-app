import Image from "next/image";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Isotipo del producto. Usa `siteConfig.logo` si está definido; si no, un
 * monograma con la inicial sobre el color primario. Es decorativo: el nombre
 * de la marca siempre aparece como texto al lado.
 */
export function Logo({ className }: { className?: string }) {
  if (siteConfig.logo) {
    return (
      <Image
        src={siteConfig.logo}
        alt=""
        width={32}
        height={32}
        className={cn("size-8 shrink-0 rounded-lg object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary text-[15px] font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(0_0_0/0.12)]",
        className,
      )}
    >
      {siteConfig.name.charAt(0).toUpperCase()}
    </span>
  );
}
