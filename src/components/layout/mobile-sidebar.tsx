"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "radix-ui";
import { SidebarContent } from "@/components/layout/sidebar";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { Button } from "@/components/ui/button";

/** Drawer de navegación para pantallas < lg. */
export function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const close = () => setMobileOpen(false);

  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <AnimatePresence>
        {mobileOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-popover outline-none lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", duration: 0.4, bounce: 0 }}
              >
                <Dialog.Title className="sr-only">Menú de navegación</Dialog.Title>
                <SidebarContent
                  onNavigate={close}
                  headerAction={
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Cerrar menú">
                        <X />
                      </Button>
                    </Dialog.Close>
                  }
                />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
