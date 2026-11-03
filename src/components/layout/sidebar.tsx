"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navigation, type NavGroup, type NavLink, type NavSection } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { useSignOut } from "@/hooks/use-sign-out";
import { isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useDemoData } from "./demo-data";

const itemClass =
  "group/item relative flex h-9 w-full min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:-outline-offset-2";

const itemActiveClass = "bg-primary/10 text-foreground hover:bg-primary/10";

const iconClass = "size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground";

/** Texto que se desvanece cuando el aside se reduce a íconos. */
const fadeClass = "truncate transition-opacity duration-200 sidebar-collapsed:opacity-0";

/** Aside fijo de desktop. En mobile se usa <MobileSidebar>. */
export function AppSidebar() {
  return (
    <div
      id="app-sidebar"
      className="sticky top-0 z-20 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-snappy lg:flex sidebar-collapsed:w-16"
    >
      <SidebarContent rail />
    </div>
  );
}

type SidebarContentProps = {
  /** Versión de desktop: admite el modo colapsado (solo íconos). */
  rail?: boolean;
  /** Se llama al navegar; el drawer mobile lo usa para cerrarse. */
  onNavigate?: () => void;
  /** Slot a la derecha del header (ej. botón de cerrar del drawer). */
  headerAction?: React.ReactNode;
};

export function SidebarContent({ rail = false, onNavigate, headerAction }: SidebarContentProps) {
  const { collapsed } = useSidebar();
  const iconOnly = rail && collapsed;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href="/" onClick={onNavigate} className="flex min-w-0 items-center gap-3 rounded-lg">
          <Logo />
          <span className={cn("flex min-w-0 flex-col", fadeClass)}>
            <span className="truncate text-sm leading-5 font-semibold tracking-tight">{siteConfig.name}</span>
            <span className="truncate text-xs leading-4 text-muted-foreground">{siteConfig.tagline}</span>
          </span>
        </Link>
        {headerAction && <div className="ml-auto">{headerAction}</div>}
      </div>

      <nav aria-label="Principal" className="min-h-0 flex-1 scrollbar-thin overflow-x-hidden overflow-y-auto px-3 py-4">
        {/*
          La ruta actual es dato de la URL: en rutas con parámetros dinámicos
          (ej. /clientes/[id]) se resuelve recién en el request. Mientras tanto
          se muestra el mismo menú sin item activo, y el layout sigue estático.
        */}
        <Suspense fallback={<NavSections pathname={null} iconOnly={iconOnly} onNavigate={onNavigate} />}>
          <ActiveNavSections iconOnly={iconOnly} onNavigate={onNavigate} />
        </Suspense>
      </nav>

      <SidebarFooter iconOnly={iconOnly} />
    </div>
  );
}

type ItemProps = {
  /** Ruta actual; null mientras no se conoce (sin item activo). */
  pathname: string | null;
  iconOnly: boolean;
  onNavigate?: () => void;
};

function ActiveNavSections(props: Omit<ItemProps, "pathname">) {
  return <NavSections pathname={usePathname()} {...props} />;
}

function NavSections(props: ItemProps) {
  return (
    <div className="flex flex-col gap-5">
      {navigation.map((section) => (
        <NavSectionBlock key={section.label} section={section} {...props} />
      ))}
    </div>
  );
}

function NavSectionBlock({ section, pathname, iconOnly, onNavigate }: ItemProps & { section: NavSection }) {
  const labelId = useId();

  return (
    <div>
      <div className="relative flex h-7 items-center px-3">
        <p
          id={labelId}
          className={cn("text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase", fadeClass)}
        >
          {section.label}
        </p>
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 h-px w-4 -translate-x-1/2 bg-border-strong opacity-0 transition-opacity duration-200 sidebar-collapsed:opacity-100"
        />
      </div>
      <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <li key={item.title}>
            {item.items ? (
              <NavGroupItem group={item} pathname={pathname} iconOnly={iconOnly} onNavigate={onNavigate} />
            ) : (
              <NavLinkItem link={item} pathname={pathname} iconOnly={iconOnly} onNavigate={onNavigate} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLinkItem({ link, pathname, iconOnly, onNavigate }: ItemProps & { link: NavLink }) {
  const active = isActivePath(pathname, link.href);
  const Icon = link.icon;

  return (
    <RailTooltip label={link.title} enabled={iconOnly}>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(itemClass, active && itemActiveClass)}
      >
        {Icon && <Icon aria-hidden className={cn(iconClass, active && "text-primary")} />}
        <span className={fadeClass}>{link.title}</span>
        {link.badge && (
          <>
            <Badge variant="accent" dot className="ml-auto sidebar-collapsed:opacity-0">
              {link.badge}
            </Badge>
            <span
              aria-hidden
              className="absolute top-2 left-6 size-1.5 rounded-full bg-accent opacity-0 ring-2 ring-surface sidebar-collapsed:opacity-100"
            />
          </>
        )}
      </Link>
    </RailTooltip>
  );
}

function NavGroupItem({ group, pathname, iconOnly, onNavigate }: ItemProps & { group: NavGroup }) {
  const listId = useId();
  const childActive = group.items.some((child) => isActivePath(pathname, child.href));
  const [open, setOpen] = useState(childActive);

  // Si se llega a un subitem desde otro lado (breadcrumb, link), el grupo se abre.
  const [prevChildActive, setPrevChildActive] = useState(childActive);
  if (childActive !== prevChildActive) {
    setPrevChildActive(childActive);
    if (childActive) setOpen(true);
  }

  const Icon = group.icon;
  const trigger = (
    <button
      type="button"
      className={cn(itemClass, childActive && "text-foreground sidebar-collapsed:bg-primary/10")}
      {...(!iconOnly && {
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-controls": open ? listId : undefined,
      })}
    >
      <Icon aria-hidden className={cn(iconClass, childActive && "sidebar-collapsed:text-primary")} />
      <span className={fadeClass}>{group.title}</span>
      <ChevronDown
        aria-hidden
        className={cn(
          "ml-auto size-4 shrink-0 text-muted-foreground transition-[rotate,opacity] duration-200 ease-snappy sidebar-collapsed:opacity-0",
          !open && "-rotate-90",
        )}
      />
    </button>
  );

  // Aside colapsado: los subitems se abren en un menú flotante al costado.
  if (iconOnly) {
    return (
      <DropdownMenu>
        <RailTooltip label={group.title} enabled>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </RailTooltip>
        <DropdownMenuContent side="right" align="start" sideOffset={14} className="min-w-52">
          <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
          {group.items.map((child) => {
            const active = isActivePath(pathname, child.href);
            const ChildIcon = child.icon;
            return (
              <DropdownMenuItem key={child.href} asChild className={cn(active && "bg-primary/10 font-medium")}>
                <Link href={child.href} aria-current={active ? "page" : undefined}>
                  {ChildIcon && <ChildIcon aria-hidden className={cn(active && "text-primary!")} />}
                  {child.title}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      {trigger}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="submenu"
            id={listId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.32, bounce: 0 }}
            className="overflow-hidden sidebar-collapsed:hidden"
          >
            <ul className="mt-0.5 ml-5 flex flex-col gap-0.5 border-l border-border pb-1 pl-3">
              {group.items.map((child) => (
                <li key={child.href}>
                  <SubItemLink link={child} pathname={pathname} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SubItemLink({ link, pathname, onNavigate }: Omit<ItemProps, "iconOnly"> & { link: NavLink }) {
  const active = isActivePath(pathname, link.href);
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/item relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:-outline-offset-2",
        active &&
          "bg-primary/10 font-medium text-foreground before:absolute before:inset-y-1.5 before:-left-3.25 before:w-px before:bg-primary hover:bg-primary/10",
      )}
    >
      {Icon && (
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover/item:text-foreground",
          )}
        />
      )}
      <span className="truncate">{link.title}</span>
    </Link>
  );
}

function SidebarFooter({ iconOnly }: { iconOnly: boolean }) {
  const { signOut, pending } = useSignOut();
  const datosDeDemostracion = useDemoData();

  return (
    <div className="shrink-0">
      <p className="px-6 pb-2 font-mono text-[11px] text-muted-foreground sidebar-collapsed:hidden">
        {siteConfig.version}
        {datosDeDemostracion && " · datos de demostración"}
      </p>
      <div className="border-t border-border p-3">
        <RailTooltip label="Cerrar sesión" enabled={iconOnly}>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className={cn(
              itemClass,
              "border border-border-strong bg-surface text-foreground shadow-card transition-[background-color,color,scale] ease-snappy hover:bg-muted active:scale-[0.98] disabled:opacity-60",
            )}
          >
            <LogOut aria-hidden className={iconClass} />
            <span className={fadeClass}>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</span>
          </button>
        </RailTooltip>
      </div>
    </div>
  );
}

/** Tooltip que solo se muestra con el aside colapsado. */
function RailTooltip({ label, enabled, children }: { label: string; enabled: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={enabled && open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={14}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
