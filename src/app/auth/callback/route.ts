import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";

/**
 * C7 — destino del login por OAuth (Google/Apple, cuando haya credenciales
 * configuradas — `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS`). El email de A2/A3 usa
 * un código OTP de 6 dígitos verificado directo en el cliente
 * (`supabase.auth.verifyOtp`), no este route — no necesita el intercambio
 * PKCE de acá porque nunca sale de la pestaña. Supabase redirige acá con
 * `?code=...`; esto lo canjea por una sesión real y deja las cookies
 * puestas antes de mandar al usuario a seguir el onboarding. `next` deja
 * seguir directo a la app si el login fue para re-entrar, no para un
 * onboarding nuevo — validado por `safeNextPath` (B11).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Código ausente o inválido — vuelve al inicio del login, no a un modo
  // "sin conexión" (§ 1.7 de CLAUDE.md: esa tarjeta se descartó a propósito).
  return NextResponse.redirect(`${origin}/onboarding?error=oauth_invalido`);
}
