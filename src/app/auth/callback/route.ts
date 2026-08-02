import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * C7 — destino del login por OAuth (Google/Apple, cuando haya credenciales
 * configuradas — `NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS`) vía `?code=` (PKCE),
 * y del link del mail de verificación vía `?token_hash=...&type=email`
 * (plantilla propia — `supabase/templates/magic_link.html`): ese link se
 * abre en una pestaña nueva donde el `verifyOtp` en cliente de A3 no
 * aplica, así que se verifica acá server-side y las cookies quedan puestas
 * antes de redirigir. El código OTP de 6 dígitos tipeado a mano (A3) sigue
 * sin pasar por acá — nunca sale de su pestaña. `next` deja seguir directo
 * a la app si el login fue para re-entrar, no para un onboarding nuevo —
 * validado por `safeNextPath` (B11).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = EMAIL_OTP_TYPES.find((t) => t === rawType) ?? null;
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Código/link ausente, inválido o vencido — vuelve al inicio del login
  // (A2 muestra el aviso por `?error` y propone pedir un código nuevo), no
  // a un modo "sin conexión" (CLAUDE.md: esa tarjeta se descartó a propósito).
  return NextResponse.redirect(`${origin}/onboarding?error=link_invalido`);
}
