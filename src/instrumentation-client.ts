import * as Sentry from "@sentry/nextjs";
import { opcionesDeSentry } from "@/lib/sentry";

// Errores del navegador. Fuera de QA y producción queda apagado (src/lib/sentry.ts).
Sentry.init(opcionesDeSentry());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
