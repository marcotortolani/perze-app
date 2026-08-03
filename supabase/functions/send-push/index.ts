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
//
// E13 — sin CORS ni handler de OPTIONS a propósito: esto es de facto
// server-to-server (cron/trigger de Postgres, nunca el navegador del
// usuario final). Agregar `Access-Control-Allow-Origin: *` para "arreglar"
// un error de fetch desde el cliente reabriría E1: cualquier página podría
// invocar esto directo. Si algún día hace falta un caller de browser,
// eso pide un endpoint propio con su propio modelo de autorización, no
// relajar CORS acá.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { z } from "npm:zod@4";

const requestSchema = z.object({
  householdId: z.uuid(),
  kind: z.enum(["budget_alerts", "weekly_summary", "recurring_reminders", "insights", "card_statement_due"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  // E2 — solo ruta relativa: nunca una URL absoluta a otro origen (phishing
  // encadenado con el ícono/nombre de PERZE, ver sw.ts `notificationclick`).
  url: z
    .string()
    .max(500)
    .regex(/^\/(?!\/)/, "url debe ser una ruta relativa que empiece con /")
    .optional(),
});

const PREFERENCE_COLUMN: Record<z.infer<typeof requestSchema>["kind"], string> = {
  budget_alerts: "budget_alerts",
  weekly_summary: "weekly_summary",
  recurring_reminders: "recurring_reminders",
  insights: "insights",
  card_statement_due: "card_statement_due",
};

/** E10 — nunca se devuelve `error.message` de Postgres al invocador (nombres de tabla, constraints). Log interno, respuesta opaca. */
function internalError(context: string, error: unknown): Response {
  console.error(`[send-push] ${context}:`, error);
  return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  // E12 — guard de método explícito, antes de tocar el body.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@example.com";
  if (!vapidPublicKey || !vapidPrivateKey) {
    return internalError("VAPID keys not configured", new Error("missing VAPID env"));
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // E12 — req.json() puede tirar con un body vacío o JSON inválido.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const { householdId, kind, title, body, url } = parsed.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // E1 — resolver el llamador desde el JWT, nunca confiar en el
  // householdId del body solo. Dos callers legítimos, dos caminos:
  // (a) un cron/trigger de sistema (pg_cron+pg_net, Vercel Cron) que manda
  //     el propio `service_role` key como Bearer — ese caller decide qué
  //     mandar y a quién, no hay "membresía" que chequearle: si tiene el
  //     secret, ya es de máxima confianza (nunca sale del server, ver
  //     `CLAUDE.md`).
  // (b) un usuario real (p. ej. un botón "mandate una notificación de
  //     prueba") con su access token — a ESE sí hay que confirmarle que
  //     pertenece al household que dice, o cualquiera con un householdId
  //     ajeno (UUID v7, no secreto: viaja en URLs y payloads) podía
  //     mandar notificaciones arbitrarias a toda la familia.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  const isSystemCaller = bearerToken === serviceRoleKey;

  if (!isSystemCaller) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { data: callerMembership, error: membershipError } = await admin
      .from("household_members")
      .select("profile_id")
      .eq("household_id", householdId)
      .eq("profile_id", caller.id)
      .maybeSingle();
    if (membershipError) return internalError("membership check", membershipError);
    if (!callerMembership) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
  }

  const { data: members, error: membersError } = await admin
    .from("household_members")
    .select("profile_id")
    .eq("household_id", householdId);
  if (membersError) return internalError("list members", membersError);

  const { data: prefs, error: prefsError } = await admin
    .from("notification_preferences")
    .select("profile_id")
    .eq("household_id", householdId)
    .eq(PREFERENCE_COLUMN[kind], true);
  if (prefsError) return internalError("list opt-ins", prefsError);
  const optedInProfileIds = new Set((prefs ?? []).map((p) => p.profile_id));

  // Sin fila en notification_preferences = defaults (todo prendido, ver
  // `20260801080000...sql`) — solo se excluye a quien explícitamente apagó este tipo.
  const { data: explicitOptOuts, error: optOutsError } = await admin
    .from("notification_preferences")
    .select("profile_id")
    .eq("household_id", householdId)
    .eq(PREFERENCE_COLUMN[kind], false);
  if (optOutsError) return internalError("list opt-outs", optOutsError);
  const optedOutProfileIds = new Set((explicitOptOuts ?? []).map((p) => p.profile_id));

  const targetProfileIds = (members ?? []).map((m) => m.profile_id).filter((id) => !optedOutProfileIds.has(id) || optedInProfileIds.has(id));

  const { data: subscriptions, error: subsError } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, profile_id")
    .in("profile_id", targetProfileIds);
  if (subsError) return internalError("list subscriptions", subsError);

  const payload = JSON.stringify({ title, body, url: url ?? "/" });
  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload)
    )
  );

  // E14 — antes: `String(result.reason).includes("410")` sobre el error
  // stringificado (falsos positivos que borraban suscripciones vivas, ej.
  // un mensaje que mencione "410" por otra razón; falsos negativos que
  // acumulaban zombies). `web-push` tira un `WebPushError` con
  // `.statusCode` real — se lee ese campo, nunca el string del error.
  const deadEndpoints = (subscriptions ?? [])
    .filter((_, i) => {
      const result = results[i];
      if (result?.status !== "rejected") return false;
      const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
      return statusCode === 410 || statusCode === 404;
    })
    .map((s) => s.endpoint);
  if (deadEndpoints.length > 0) {
    const { error: cleanupError } = await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    if (cleanupError) console.error("[send-push] cleanup dead endpoints:", cleanupError);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return new Response(JSON.stringify({ sent, failed: results.length - sent }), { headers: { "Content-Type": "application/json" } });
});
