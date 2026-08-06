// Avisa por mail al owner/admin del hogar cuando alguien acepta su
// invitación — sin esto, la única forma de enterarse era abrir la app y
// entrar a Grupo familiar a mano.
//
// Deploy: `supabase functions deploy notify-invite-accepted`
// Mismos secrets que `notify-access-request` (RESEND_API_KEY, EMAIL_FROM,
// SITE_URL opcional) — no hace falta configurar nada nuevo si ese ya
// funciona.
//
// Disparada por el trigger `household_invites_notify_accepted`
// (`20260806070000_notify_invite_accepted.sql`) vía `net.http_post`, mismo
// patrón de Vault (`perze_project_url`/`perze_service_role_key`) que
// `handle_new_user()` — nunca se llama sola.
//
// Sin CORS ni handler de OPTIONS a propósito, mismo criterio que
// `send-push`/`notify-access-request`: esto es server-to-server (un
// trigger de Postgres), nunca el navegador del usuario final.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const requestSchema = z.object({ householdId: z.uuid(), newMemberId: z.uuid() });

/** Nunca se devuelve `error.message` de Postgres/Resend al invocador — log interno, respuesta opaca. */
function internalError(context: string, error: unknown): Response {
  console.error(`[notify-invite-accepted] ${context}:`, error);
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

function renderEmailHtml(params: { siteUrl: string; householdName: string; memberName: string }): string {
  const { siteUrl, householdName, memberName } = params;
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:32px 0;background:${emailTheme.page};font-family:${emailTheme.fontStack}">
  <table role="presentation" width="100%"><tr><td align="center">
    <table role="presentation" width="480" style="max-width:480px;padding:0 20px">
      <tr><td style="padding-bottom:24px">
        <img src="${siteUrl}/email/wordmark-light.png" width="76" height="22" alt="PERZE" style="display:block" />
      </td></tr>
      <tr><td style="background:${emailTheme.surface1};border:1px solid ${emailTheme.border};border-radius:20px;padding:24px">
        <h2 style="margin:0 0 8px;font-size:22px;line-height:28px;color:${emailTheme.textPrimary}">Nuevo miembro en tu hogar</h2>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:${emailTheme.textSecondary}">
          ${memberName} aceptó tu invitación y ya es parte de "${householdName}".
        </p>
        <a href="${siteUrl}/family" style="display:block;width:100%;box-sizing:border-box;height:56px;line-height:56px;text-align:center;background:${emailTheme.primaryFill};color:${emailTheme.primaryOnFill};border-radius:16px;font-size:16px;font-weight:600;text-decoration:none">Ver grupo familiar</a>
        <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:${emailTheme.textMuted}">
          Podés ajustar qué ve cada miembro desde Permisos y visibilidad.
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

  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (bearerToken !== serviceRoleKey) return jsonError("unauthenticated", 401);
  if (!resendApiKey || !emailFrom) {
    console.log("[notify-invite-accepted] RESEND_API_KEY/EMAIL_FROM no configurados — sin enviar");
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
  const { householdId, newMemberId } = parsed.data;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: household, error: householdError }, { data: newMember, error: newMemberError }, { data: recipients, error: recipientsError }] = await Promise.all([
    admin.from("households").select("name").eq("id", householdId).maybeSingle(),
    admin.from("profiles").select("display_name").eq("id", newMemberId).maybeSingle(),
    // Al owner/admin, no al que se acaba de unir — y solo miembros activos:
    // uno que dejó el hogar no tiene por qué seguir enterándose de altas.
    admin.from("household_members").select("profile_id").eq("household_id", householdId).eq("status", "active").in("role", ["owner", "admin"]).neq("profile_id", newMemberId),
  ]);
  if (householdError) return internalError("read household", householdError);
  if (newMemberError) return internalError("read new member profile", newMemberError);
  if (recipientsError) return internalError("list recipients", recipientsError);
  if (!household || !recipients || recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const html = renderEmailHtml({
    siteUrl,
    householdName: household.name,
    memberName: newMember?.display_name?.trim() || "Alguien",
  });

  const recipientEmails = (
    await Promise.all(
      recipients.map(async (r) => {
        const { data, error } = await admin.auth.admin.getUserById(r.profile_id);
        if (error) {
          console.error("[notify-invite-accepted] read recipient email:", error);
          return null;
        }
        return data.user?.email ?? null;
      })
    )
  ).filter((e): e is string => !!e);

  if (recipientEmails.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  const results = await Promise.allSettled(
    recipientEmails.map((to) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: emailFrom, to, subject: `${newMember?.display_name?.trim() || "Alguien"} se unió a tu hogar — PERZE`, html }),
      }).then((res) => {
        if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  if (failed > 0) console.error(`[notify-invite-accepted] ${failed} envío(s) fallaron`);
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});
