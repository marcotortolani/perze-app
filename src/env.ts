import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

/**
 * Variables de entorno tipadas y validadas en build. El backend sigue
 * siendo local-first (Dexie + outbox): Supabase se lee/escribe detrás de
 * TanStack Query, nunca bloquea el arranque. La publishable key es segura
 * en el bundle — RLS es la barrera real, nunca el secreto de esta key
 * (`CLAUDE.md` § RLS). La `service_role` key NUNCA entra acá: solo Edge
 * Functions/cron.
 */
export const env = createEnv({
  server: {
    // Resend — mails que manda la propia app (hoy solo la invitación al
    // household, J3). Secreto de servidor: nunca `NEXT_PUBLIC_*`, nunca en
    // el bundle del cliente (`CLAUDE.md`). Opcional a propósito — un
    // self-host sin Resend configurado no debe romper el build; el route
    // handler (`src/app/api/emails/invite/route.ts`) devuelve 503
    // explícito si falta.
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.email().optional(),
    // Finnhub — cotizaciones de acciones/ETFs de EE.UU. (NYSE/NASDAQ),
    // fuera de lo que cubre Data912 (solo mercado argentino). Mismo
    // criterio que Resend: opcional, nunca en el bundle del cliente — sin
    // ella, la búsqueda de instrumentos y `/api/prices` simplemente no
    // ofrecen resultados de Finnhub (`createFinnhubProvider`/
    // `searchFinnhubInstruments` devuelven vacío en vez de romper).
    FINNHUB_API_KEY: z.string().min(1).optional(),
  },
  client: {
    // Para `metadataBase` (og:image, apple-touch-icon absolutos) — sin
    // dominio propio todavía, cae a localhost en dev/preview.
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // K12 — clave pública VAPID para push. Opcional: sin ella, `more/notifications`
    // sigue mostrando las preferencias, pero `subscribeToPush` falla explícito
    // (nunca en silencio) en vez de dejar suscribirse a un push que no puede llegar.
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    // B18 — era la única variable pública que se leía directo de
    // `process.env` en vez de pasar por acá (`onboarding/page.tsx`),
    // invisible para quien hace self-host y solo mira este contrato.
    // CSV de "google"/"apple" — cuáles OAuth providers están registrados
    // en Supabase Auth (CLAUDE.md § "Orden de A2"); vacío = sin OAuth, los
    // botones no se dibujan (nunca deshabilitados).
    NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS: z.string().optional(),
    // El service worker NO se registra en desarrollo: con Turbopack los
    // nombres de chunk cambian en cada arranque, así que el precache de la
    // sesión anterior sirve HTML que apunta a archivos que ya no existen y
    // la app queda en blanco, sin un solo error en consola que lo explique.
    // `"1"` lo enciende igual, para poder probar offline/instalación local.
    NEXT_PUBLIC_ENABLE_SW_IN_DEV: z.string().optional(),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS: process.env.NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS,
    NEXT_PUBLIC_ENABLE_SW_IN_DEV: process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV,
  },
});
