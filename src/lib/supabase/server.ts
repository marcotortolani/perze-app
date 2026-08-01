import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/env";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers — lee/escribe cookies de sesión vía `next/headers`. `cookies()`
 * es async en Next.js 16 (`CLAUDE.md` § gotchas), por eso esta fábrica
 * también lo es.
 *
 * El `set` puede fallar si se llama desde un Server Component puro (sin
 * Server Action ni Route Handler de por medio) — Next.js no deja escribir
 * cookies ahí. Se ignora a propósito: `proxy.ts` ya se encarga de refrescar
 * la sesión en cada request, así que un Server Component de solo lectura
 * no necesita poder escribir la cookie él mismo.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component sin Server Action/Route Handler: no se puede
          // escribir. proxy.ts refresca la sesión en el siguiente request.
        }
      },
    },
  });
}
