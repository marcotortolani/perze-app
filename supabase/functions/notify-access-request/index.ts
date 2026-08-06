// Avisa por mail al operador (o a los operadores, si hay más de uno) cuando
// alguien nuevo se registra y queda `access_status = 'pending'` — sin esto,
// la única forma de enterarse era abrir la app y entrar a Panel del operador.
//
// Deploy: `supabase functions deploy notify-access-request`
// Secrets necesarios (nunca en el bundle del cliente):
//   `supabase secrets set RESEND_API_KEY=... EMAIL_FROM=notificaciones@tu-dominio.com`
//   `supabase secrets set SITE_URL=https://tu-dominio.com` (opcional — cae a
//   la URL de este proyecto si no se define)
//
// Disparada por `handle_new_user()` (`20260806010000_notify_admin_on_signup.sql`)
// vía `net.http_post`, con el mismo patrón de `perze_project_url`/
// `perze_service_role_key` en Vault que ya usa `dispatch_due_notifications()`
// (`20260801160000_cron_engines.sql`) — nunca se llama sola.
//
// Sin CORS ni handler de OPTIONS a propósito, mismo criterio que
// `send-push`: esto es server-to-server (un trigger de Postgres), nunca el
// navegador del usuario final.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const requestSchema = z.object({ profileId: z.uuid() });

/** Nunca se devuelve `error.message` de Postgres/Resend al invocador — log interno, respuesta opaca. */
function internalError(context: string, error: unknown): Response {
  console.error(`[notify-access-request] ${context}:`, error);
  return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { "Content-Type": "application/json" } });
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

const emailTheme = {
  page: "#FAFAF9",
  surface1: "#FFFFFF",
  border: "#E4E4E1",
  textPrimary: "#131315",
  textSecondary: "#5A5A60",
  textMuted: "#6B6B71",
  primaryFill: "#6D55F0",
  primaryOnFill: "#FFFFFF",
  fontStack: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

function renderEmailHtml(params: { siteUrl: string; email: string; country: string | null; displayName: string | null }): string {
  const { siteUrl, email, country, displayName } = params;
  const who = displayName ? `${displayName} (${email})` : email;
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:32px 0;background:${emailTheme.page};font-family:${emailTheme.fontStack}">
  <table role="presentation" width="100%"><tr><td align="center">
    <table role="presentation" width="480" style="max-width:480px;padding:0 20px">
      <tr><td style="padding-bottom:24px">
        <img src="${siteUrl}/email/wordmark-light.png" width="76" height="22" alt="PERZE" style="display:block" />
      </td></tr>
      <tr><td style="background:${emailTheme.surface1};border:1px solid ${emailTheme.border};border-radius:20px;padding:24px">
        <h2 style="margin:0 0 8px;font-size:22px;line-height:28px;color:${emailTheme.textPrimary}">Nueva solicitud de acceso</h2>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:${emailTheme.textSecondary}">
          ${who} pidió entrar a tu instalación de PERZE${country ? ` desde ${country}` : ""}.
        </p>
        <a href="${siteUrl}/more/admin" style="display:block;width:100%;box-sizing:border-box;height:56px;line-height:56px;text-align:center;background:${emailTheme.primaryFill};color:${emailTheme.primaryOnFill};border-radius:16px;font-size:16px;font-weight:600;text-decoration:none">Revisar en el panel</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:${emailTheme.textMuted}">
          No entra a nada hasta que la apruebes vos — el acceso queda bloqueado por default.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonError("method_not_allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://perze.tortolani.cc";
  if (!supabaseUrl || !serviceRoleKey) return internalError("missing Supabase env", new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY"));

  // Solo el trigger de Postgres invoca esto — nunca un usuario ni el
  // cliente. Sin RESEND_API_KEY/EMAIL_FROM (self-host sin Resend
  // configurado todavía) sale en silencio, mismo criterio que
  // `dispatch_due_notifications()` sin los secrets de Vault: no es un
  // error, es "todavía no hay a dónde mandar el mail".
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (bearerToken !== serviceRoleKey) return jsonError("unauthenticated", 401);
  if (!resendApiKey || !emailFrom) {
    console.log("[notify-access-request] RESEND_API_KEY/EMAIL_FROM no configurados — sin enviar");
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) return jsonError("invalid_body", 400);
  const { profileId } = parsed.data;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: profile, error: profileError }, { data: adminProfiles, error: adminsError }] = await Promise.all([
    admin.from("profiles").select("display_name, country").eq("id", profileId).maybeSingle(),
    admin.from("profiles").select("id").eq("is_app_admin", true),
  ]);
  if (profileError) return internalError("read profile", profileError);
  if (adminsError) return internalError("list admins", adminsError);
  if (!profile || !adminProfiles || adminProfiles.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { data: requesterUser, error: requesterError } = await admin.auth.admin.getUserById(profileId);
  if (requesterError) return internalError("read requester email", requesterError);

  const html = renderEmailHtml({
    siteUrl,
    email: requesterUser.user?.email ?? profileId,
    country: profile.country,
    displayName: profile.display_name,
  });

  const adminEmails = (
    await Promise.all(
      adminProfiles.map(async (a) => {
        const { data, error } = await admin.auth.admin.getUserById(a.id);
        if (error) {
          console.error("[notify-access-request] read admin email:", error);
          return null;
        }
        return data.user?.email ?? null;
      })
    )
  ).filter((e): e is string => !!e);

  if (adminEmails.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  const results = await Promise.allSettled(
    adminEmails.map((to) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: emailFrom, to, subject: "Nueva solicitud de acceso — PERZE", html }),
      }).then((res) => {
        if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  if (failed > 0) console.error(`[notify-access-request] ${failed} envío(s) fallaron`);
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});
