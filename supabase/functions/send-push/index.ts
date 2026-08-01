// K12 — envía un push a los dispositivos suscritos de un household, filtrado
// por `notification_preferences`. Server-side puro: usa `service_role` para
// leer `push_subscriptions`/`notification_preferences` (RLS los restringe a
// la fila propia del cliente, así que el envío real solo puede pasar acá).
//
// Deploy: `supabase functions deploy send-push`
// Secret necesario (nunca en el bundle del cliente):
//   `supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:tu@email.com`
//
// Esta función NO se llama sola: alguien tiene que invocarla (un cron de
// pg_cron+pg_net, un Vercel Cron pegándole a esta URL, o un trigger de
// Postgres). Deliberadamente no se programó ese disparador en esta pasada
// — encender un envío automático recurrente es una decisión de producto
// (frecuencia, qué dispara cada tipo de notificación) que no se toma sola.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

interface SendPushRequest {
  householdId: string;
  kind: "budget_alerts" | "weekly_summary" | "recurring_reminders" | "insights";
  title: string;
  body: string;
  url?: string;
}

const PREFERENCE_COLUMN: Record<SendPushRequest["kind"], string> = {
  budget_alerts: "budget_alerts",
  weekly_summary: "weekly_summary",
  recurring_reminders: "recurring_reminders",
  insights: "insights",
};

Deno.serve(async (req) => {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@example.com";
  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { householdId, kind, title, body, url }: SendPushRequest = await req.json();

  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("profile_id")
    .eq("household_id", householdId);
  if (membersError) return new Response(JSON.stringify({ error: membersError.message }), { status: 500 });

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("profile_id")
    .eq("household_id", householdId)
    .eq(PREFERENCE_COLUMN[kind], true);
  const optedInProfileIds = new Set((prefs ?? []).map((p) => p.profile_id));

  // Sin fila en notification_preferences = defaults (todo prendido, ver
  // `20260801080000...sql`) — solo se excluye a quien explícitamente apagó este tipo.
  const { data: explicitOptOuts } = await supabase
    .from("notification_preferences")
    .select("profile_id")
    .eq("household_id", householdId)
    .eq(PREFERENCE_COLUMN[kind], false);
  const optedOutProfileIds = new Set((explicitOptOuts ?? []).map((p) => p.profile_id));

  const targetProfileIds = (members ?? []).map((m) => m.profile_id).filter((id) => !optedOutProfileIds.has(id) || optedInProfileIds.has(id));

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, profile_id")
    .in("profile_id", targetProfileIds);
  if (subsError) return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });

  const payload = JSON.stringify({ title, body, url: url ?? "/" });
  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload)
    )
  );

  // Un endpoint que devuelve 410 Gone es una suscripción muerta (usuario
  // desinstaló, permiso revocado desde el navegador) — se limpia, no se
  // reintenta para siempre.
  const deadEndpoints = (subscriptions ?? [])
    .filter((_, i) => {
      const result = results[i];
      return result?.status === "rejected" && String(result.reason).includes("410");
    })
    .map((s) => s.endpoint);
  if (deadEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return new Response(JSON.stringify({ sent, failed: results.length - sent }), { headers: { "Content-Type": "application/json" } });
});
