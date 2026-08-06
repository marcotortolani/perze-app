import type { MetadataRoute } from "next";
import { env } from "@/env";

/**
 * No existía — `/robots.txt` caía en `proxy.ts` como cualquier ruta sin
 * sesión y volvía un 307 a `/onboarding`. Un robots.txt que redirige a un
 * login se lee como "todo el sitio requiere sesión", que es lo que
 * bloqueaba la verificación de marca de Google (`/about` respondía bien
 * al pedirla directo, pero un crawler que primero mira robots.txt nunca
 * llegaba a intentarlo) — ver `docs/mejora-auth-oauth-y-email.md` § 2.
 *
 * `/about` y `/start` (la landing — `proxy.ts` manda ahí a cualquier
 * visitante sin sesión que entra a "/") son las únicas públicas de
 * verdad; el resto del sitio exige sesión (`src/lib/auth/public-paths.ts`),
 * así que no tiene sentido ofrecerlo para indexar. `disallow: ["/"]`
 * sigue siendo correcto tal cual: bloquea la raíz (que sin sesión ni
 * siquiera renderiza, solo redirige) sin bloquear `/start` ni `/about`,
 * que son rutas propias — un `allow` más específico siempre gana sobre
 * un `disallow` más general en la spec de robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://perze.tortolani.cc";
  return {
    rules: { userAgent: "*", allow: ["/about", "/start"], disallow: ["/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
