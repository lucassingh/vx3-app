"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { primerNombre } from "@/lib/format";
import { toast } from "@/lib/toast";
import { signIn } from "@/modules/platform/auth/actions";

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
        identifier: String(data.get("identifier") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.mustChangePassword) {
        router.replace("/cambiar-contrasena");
        return;
      }
      toast.success("Sesión iniciada", { description: `Hola de nuevo, ${primerNombre(result.data.name)}.` });
      router.replace("/");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">Email o usuario</Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nombre@empresa.com"
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
