"use client";

import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";

export function FirstPasswordForm() {
  const router = useRouter();
  const { signOut, pending } = useSignOut();

  return (
    <div className="space-y-3">
      <ChangePasswordForm submitLabel="Guardar y entrar" onDone={() => router.replace("/")} />
      <Button type="button" variant="ghost" className="w-full" onClick={signOut} disabled={pending}>
        Salir
      </Button>
    </div>
  );
}
