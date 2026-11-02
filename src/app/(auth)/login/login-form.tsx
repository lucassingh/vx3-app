"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { currentUser } from "@/lib/auth";
import { signIn } from "@/lib/auth-actions";
import { toast } from "@/lib/toast";

/** Precargadas mientras hay un solo usuario (ver src/lib/session.ts). */
const DEFAULT_EMAIL = "eliasllaury@gmail.com";
const DEFAULT_PASSWORD = "Admin123456!";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signIn({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      if (result.ok) {
        toast.success("Sesión iniciada", {
          description: `Hola de nuevo, ${currentUser.name.split(" ")[0]}.`,
        });
        router.replace("/");
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com"
          defaultValue={DEFAULT_EMAIL}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            defaultValue={DEFAULT_PASSWORD}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label="Mostrar contraseña"
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:-outline-offset-2"
          >
            {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p id="login-error" role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <LoaderCircle aria-hidden className="animate-spin" />}
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
