"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { signOut } from "@/modules/platform/auth/actions";
import { toast } from "@/lib/toast";

export function useSignOut() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSignOut = useCallback(() => {
    startTransition(async () => {
      await signOut();
      toast.success("Cerraste sesión", { description: "Te esperamos de vuelta." });
      router.replace("/login");
    });
  }, [router]);

  return { signOut: handleSignOut, pending };
}
