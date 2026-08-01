import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { isPublicPath } from "@/lib/auth/public-paths";

/**
 * Next.js 16 renombró `middleware.ts` → `proxy.ts` (`CLAUDE.md` § gotchas).
 * Refresca el token de sesión de Supabase en cada request — sin esto, un
 * access token vencido rompe silenciosamente los Server Components que
 * dependen de `auth.uid()` vía RLS, en vez de refrescarse solo.
 *
 * B1 — antes esto disparaba `getUser()` y descartaba el resultado: con
 * sesión vencida, revocada o inexistente, cualquiera con acceso al perfil
 * del navegador veía el shell completo (saldos, movimientos, análisis
 * locales en Dexie) sin que la expiración del token expulsara a nadie. Acá
 * es el único punto server-side que ve la sesión real, así que el redirect
 * tiene que vivir acá — el gate de Dexie (`OnboardingGate`) solo sabe si
 * hay un household local, no si la sesión de Supabase sigue viva.
 *
 * Esto NO reemplaza el gate de PIN local (bloqueo pre-auth, bloque L6): esa
 * es una capa completamente aparte, encima de esto (PIN bloquea con sesión
 * viva; esto expulsa cuando la sesión ya no existe).
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    // El redirect necesita las cookies YA refrescadas por `setAll` de
    // arriba copiadas explícitamente — si se devuelve un NextResponse
    // nuevo sin ellas, la próxima request vuelve a ver el token vencido y
    // entra en loop.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

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
