import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { isPublicPath } from "@/lib/auth/public-paths";
import { DEMO_COOKIE_NAME, isDemoCookieValue } from "@/lib/demo/demo-cookie";

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

  // Modo demo (§0, plan de acceso controlado) — 100% local, sin sesión de
  // Supabase a propósito. La cookie es la única señal que este chokepoint
  // puede ver; no habilita ninguna lectura contra Supabase, RLS sigue
  // exigiendo `auth.uid()` real para cualquier fila.
  const isDemo = isDemoCookieValue(request.cookies.get(DEMO_COOKIE_NAME)?.value);

  if (!user && !isDemo && !isPublicPath(request.nextUrl.pathname)) {
    return redirectTo(request, response, "/onboarding");
  }

  // Acceso controlado (§3.2) — verificarse por OTP/contraseña no alcanza:
  // hace falta la aprobación del operador antes de tocar cualquier ruta
  // real de la app. `/onboarding/*` queda afuera (`isPublicPath`) porque
  // ahí es donde alguien SIN aprobación todavía tiene que poder aterrizar
  // en `/pending`; esa pantalla también queda afuera para no loopear.
  if (user && !isPublicPath(request.nextUrl.pathname) && request.nextUrl.pathname !== "/pending") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("access_status, last_seen_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.access_status !== "approved") {
      return redirectTo(request, response, "/pending");
    }

    // Recencia de uso para las métricas del operador (§3.4) — un timestamp,
    // no un log. Acotado a la fila propia (self-only en RLS) y a lo sumo
    // una vez por día por usuario, para no convertir cada navegación en un
    // UPDATE. Best-effort: un fallo acá nunca bloquea la request real.
    const lastSeenAt = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
    if (Date.now() - lastSeenAt > 24 * 60 * 60 * 1000) {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id)
        .then(() => {}, () => {});
    }
  }

  return response;
}

function redirectTo(request: NextRequest, response: NextResponse, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  // El redirect necesita las cookies YA refrescadas por `setAll` de arriba
  // copiadas explícitamente — si se devuelve un NextResponse nuevo sin
  // ellas, la próxima request vuelve a ver el token vencido y entra en loop.
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
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
