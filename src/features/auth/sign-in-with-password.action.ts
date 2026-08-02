"use server";

import { createClient } from "@/lib/supabase/server";
import { mapError, type PasswordAuthResult } from "./password-auth";

/**
 * Mismo `signInWithPassword` que `password-auth.ts`, pero por Server
 * Action: acá las cookies de sesión salen como `Set-Cookie` real de la
 * respuesta (vía `next/headers` `cookies()`), no como `document.cookie`
 * desde el cliente. Necesario porque un login por contraseña era el único
 * camino de auth de la app que nunca pasaba por el servidor — OAuth,
 * magic link y OTP ya canjean su sesión en `/auth/callback` (Route
 * Handler); una cookie escrita solo por script queda sujeta al recorte de
 * vida real que aplican Safari/WebKit (y las PWA standalone que corren
 * sobre ese motor) sin importar el `Max-Age` pedido — la sesión se perdía
 * al cerrar y reabrir la PWA instalada.
 */
export async function signInWithPasswordAction(email: string, password: string): Promise<PasswordAuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? mapError(error.message) : { errorCode: null };
}
