import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Next.js 16 renombró `middleware.ts` → `proxy.ts` (`CLAUDE.md` § gotchas).
 * Refresca el token de sesión de Supabase en cada request — sin esto, un
 * access token vencido rompe silenciosamente los Server Components que
 * dependen de `auth.uid()` vía RLS, en vez de refrescarse solo.
 *
 * Esto NO reemplaza el gate de PIN local (bloqueo pre-auth, bloque L6): esa
 * es una capa completamente aparte, encima de esto, que se agrega con C7.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Dispara el refresh — el resultado en sí no se usa acá; A2/A3 (C7) son
  // quienes deciden qué hacer con una sesión ausente o vencida.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Corre en todo salvo assets estáticos y el propio service worker —
     * tocar esas rutas en cada request rompería el cacheo de Serwist.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|splash|serwist|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
