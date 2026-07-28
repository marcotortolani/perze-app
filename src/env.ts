import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

/**
 * Variables de entorno tipadas y validadas en build. Hoy no hay ninguna
 * requerida: el backend es local-first (Dexie) y las APIs de FX
 * (`docs/01-arquitectura-datos.md` § "Confirmado por vos") no piden key.
 * Sumar acá las de Supabase cuando se conecte (Fase 9 en adelante) y las de
 * proveedores de cotización que la pidan.
 */
export const env = createEnv({
  server: {},
  client: {
    // Para `metadataBase` (og:image, apple-touch-icon absolutos) — sin
    // dominio propio todavía, cae a localhost en dev/preview.
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
});
