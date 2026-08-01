import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/env";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para Client Components. La app es local-first: el
 * cliente lee/escribe Dexie primero (`lib/offline`) y este cliente solo lo
 * usa el outbox para sincronizar, y las lecturas que necesitan Realtime.
 * Nunca se usa para mutar plata directo — eso pasa por `createOptimisticMutation()`.
 */
export function createClient() {
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
