import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { isPublicPath } from "@/lib/auth/public-paths";
import { DEMO_COOKIE_NAME, isDemoCookieValue } from "@/lib/demo/demo-cookie";
import { ACCESS_APPROVAL_COOKIE_NAME, ACCESS_APPROVAL_TTL_SECONDS, isAccessApprovalCookieValidFor } from "@/lib/auth/access-approval-cookie";
import { hasAuthCallbackParams } from "@/lib/auth/has-auth-callback-params";

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

  // B12 — un link de verificación con `redirect_to` a la raíz (plantilla
  // default de Supabase, o cualquier link ya mandado antes de este fix)
  // vuelve como `?code=...` a CUALQUIER pathname, no solo `/auth/callback`.
  // Si el chequeo de sesión de abajo lo viera primero, `redirectTo()`
  // pisaría la URL con `url.search = ""` y el código se perdería sin que
  // nadie lo canjeara — la app entera queda inaccesible por mail. Server-side
  // y antes que nada más: reenviar preservando el query completo.
  if (hasAuthCallbackParams(request.nextUrl.searchParams) && request.nextUrl.pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Fase 2 del plan de fluidez de navegación — `getUser()` pega contra el
  // Auth server de Supabase en CADA navegación (un round-trip de red antes
  // de que Next empiece a renderizar). El proyecto está migrado a JWT
  // signing keys asimétricas (ES256, `/.well-known/jwks.json` lo confirma),
  // así que `getClaims()` verifica el JWT localmente con la clave pública
  // cacheada — sin red, salvo la primera vez que trae el JWKS. Si el
  // proyecto alguna vez vuelve al secreto compartido legacy, el propio SDK
  // cae solo a `getUser()` puertas adentro (ver `auth-js`), así que esto
  // nunca queda roto en silencio, solo pierde la ganancia.
  const { data: claimsResult } = await supabase.auth.getClaims();
  const userId = claimsResult?.claims.sub;
  const user = userId ? { id: userId } : null;

  // Modo demo (§0, plan de acceso controlado) — 100% local, sin sesión de
  // Supabase a propósito. La cookie es la única señal que este chokepoint
  // puede ver; no habilita ninguna lectura contra Supabase, RLS sigue
  // exigiendo `auth.uid()` real para cualquier fila.
  const isDemo = isDemoCookieValue(request.cookies.get(DEMO_COOKIE_NAME)?.value);

  // Sin contraseñas, A2 es login/signup indistinguibles (CLAUDE.md § "Orden
  // de A2"): sin sesión, siempre `/onboarding` — ese mismo `signInWithOtp`
  // reingresa a quien ya tiene cuenta (`resolveOnboardingDestination()` lo
  // manda a la app o a `/onboarding/restore`, nunca crea un household de
  // más). La distinción "ya se registró en este dispositivo" que hacía
  // `perze_registered` era solo para elegir `/login`, que ya no existe.
  if (!user && !isDemo && !isPublicPath(request.nextUrl.pathname)) {
    // "/" es el link que se comparte de afuera — sin sesión, manda a la
    // landing (`/start`), no directo al formulario de email de A2. Cualquier
    // otra ruta protegida sin sesión sigue yendo a `/onboarding`: alguien
    // que ya tenía intención de llegar a una pantalla puntual (un deep
    // link) no necesita el discurso de venta de vuelta.
    return redirectTo(request, response, request.nextUrl.pathname === "/" ? "/start" : "/onboarding");
  }

  // Acceso controlado (§3.2) — verificarse por OTP/contraseña no alcanza:
  // hace falta la aprobación del operador antes de tocar cualquier ruta
  // real de la app. `/onboarding/*` queda afuera (`isPublicPath`) porque
  // ahí es donde alguien SIN aprobación todavía tiene que poder aterrizar
  // en `/pending`; esa pantalla también queda afuera para no loopear.
  if (user && !isPublicPath(request.nextUrl.pathname) && request.nextUrl.pathname !== "/pending") {
    // Fase 2 — el `SELECT` de abajo corría en CADA navegación. Si ya
    // sabemos (cookie httpOnly, atada a este `user.id`) que este usuario
    // está aprobado desde hace menos de `ACCESS_APPROVAL_TTL_SECONDS`,
    // saltamos la consulta entera — con el costo de que revocar acceso
    // tarda hasta ese TTL en expulsar a alguien ya navegando (ver el
    // comentario de `access-approval-cookie.ts`).
    const approvalCached = isAccessApprovalCookieValidFor(user.id, request.cookies.get(ACCESS_APPROVAL_COOKIE_NAME)?.value);

    if (!approvalCached) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("access_status, last_seen_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && profile.access_status !== "approved") {
        return redirectTo(request, response, "/pending");
      }

      if (profile) {
        response.cookies.set(ACCESS_APPROVAL_COOKIE_NAME, user.id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: ACCESS_APPROVAL_TTL_SECONDS,
          secure: env.NODE_ENV === "production",
        });
      }

      // Recencia de uso para las métricas del operador (§3.4) — un timestamp,
      // no un log. Acotado a la fila propia (self-only en RLS) y a lo sumo
      // una vez por día por usuario, para no convertir cada navegación en un
      // UPDATE. Best-effort: un fallo acá nunca bloquea la request real.
      // Con la cookie de aprobación puesta, este chequeo se salta también —
      // el próximo `last_seen_at` llega, a lo sumo, `ACCESS_APPROVAL_TTL_SECONDS`
      // más tarde que antes, irrelevante para una métrica de recencia.
      const lastSeenAt = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
      if (Date.now() - lastSeenAt > 24 * 60 * 60 * 1000) {
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id)
          .then(() => {}, () => {});
      }
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
     * Corre en todo salvo assets estáticos, el propio service worker, y
     * `/api/*` — tocar los assets rompería el cacheo de Serwist, y
     * `/api/fx` (única ruta hoy) ya se autentica sola (`getUser()` propio,
     * 401 explícito sin sesión — Fase 2 del plan de fluidez) y refresca su
     * propia cookie de sesión vía Route Handler, así que el round-trip de
     * este proxy ahí es puro costo sin nada que proteja. `manifest.webmanifest`
     * tampoco necesita el gate de acceso.
     *
     * `robots.txt` y `sitemap.xml` (`src/app/robots.ts`) tampoco pueden
     * pasar por acá: sin esta exclusión, cualquier crawler sin sesión
     * —incluido el que usa Google para la verificación de marca de OAuth,
     * `docs/mejora-auth-oauth-y-email.md` § 2— los recibía como un 307 a
     * `/onboarding` en vez del contenido real, y un robots.txt que
     * redirige a un login se lee como "todo el sitio requiere sesión" —
     * exactamente el error que bloqueaba la verificación aunque `/about`
     * respondiera bien al pedirla directo.
     */
    /*
     * `sw.js` (y su sourcemap) es el service worker, generado por
     * `scripts/build-sw.mjs` en `public/`. Sin esta exclusión el proxy lo
     * trata como una navegación más: sin sesión devuelve un 307 a
     * `/onboarding`, o sea que el navegador recibe HTML donde espera
     * JavaScript y el registro falla. Y como el registro falla en silencio
     * (`service-worker-register.tsx`), no habría PWA sin un solo error
     * visible — que es exactamente el modo de falla que ya costó una
     * versión entera.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|splash|sw.js|sw.js.map|api|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
