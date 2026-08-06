import { Resend } from "resend";
import type { ReactElement } from "react";
import { env } from "@/env";

/**
 * Wrapper del SDK de Resend para los mails que manda la propia app (no
 * los de Auth, que van por el SMTP de Supabase). Respuesta opaca: nunca
 * se devuelve el `error.message` de Resend al invocador — mismo criterio
 * que `internalError` de `supabase/functions/send-push/index.ts:49-53`.
 */
export type SendEmailResult = { ok: true } | { ok: false; reason: "not_configured" | "send_failed" };

export async function sendEmail(params: { to: string; subject: string; react: ReactElement }): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { ok: false, reason: "not_configured" };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    react: params.react,
  });

  if (error) {
    console.error("[emails/send]", error);
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
