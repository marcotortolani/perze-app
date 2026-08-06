// K12 — envía un push. Dos modelos de destinatario:
//   (a) household-scoped (los 5 tipos originales + `household_joined`):
//       todos los miembros del household, filtrados por
//       `notification_preferences`. Si además viene `profileIds`, se
//       intersecta (p. ej. "solo owner/admin", ver `household_joined`).
//   (b) profile-scoped (`household_invite`, `app_update`): sin household
//       — "te invitaron" es ANTES de ser miembro de nada, y "nueva versión"
//       es de la cuenta, no del hogar. Filtrados por
//       `profile_notification_preferences`. Sin `profileIds` en este modo
//       es un BROADCAST a todo perfil con alguna suscripción — reservado a
//       `service_role` o a un admin de la instancia (`is_app_admin`).
//
// Deploy: `supabase functions deploy send-push`
// Secret necesario (nunca en el bundle del cliente):
//   `supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:tu@email.com`
//
// Esta función NO se llama sola: alguien tiene que invocarla (un cron de
// pg_cron+pg_net, un trigger de Postgres, o un admin desde el panel).
//
// E13 — sin CORS ni handler de OPTIONS a propósito: esto es de facto
// server-to-server (cron/trigger de Postgres, o el panel de admin con su
// propio access token — nunca el navegador de un usuario común). Agregar
// `Access-Control-Allow-Origin: *` para "arreglar" un error de fetch desde
// el cliente reabriría E1: cualquier página podría invocar esto directo.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { z } from "npm:zod@4";

const HOUSEHOLD_KINDS = ["budget_alerts", "weekly_summary", "recurring_reminders", "insights", "card_statement_due", "household_joined"] as const;
const PROFILE_KINDS = ["household_invite", "app_update"] as const;

const requestSchema = z.object({
  householdId: z.uuid().optional(),
  /** Household-scoped: narrows recipients to this subset (still household members). Profile-scoped: the recipients themselves — sin esto, broadcast. */
  profileIds: z.array(z.uuid()).optional(),
  kind: z.enum([...HOUSEHOLD_KINDS, ...PROFILE_KINDS]),
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

type Kind = z.infer<typeof requestSchema>["kind"];

const HOUSEHOLD_PREFERENCE_COLUMN: Record<(typeof HOUSEHOLD_KINDS)[number], string> = {
  budget_alerts: "budget_alerts",
  weekly_summary: "weekly_summary",
  recurring_reminders: "recurring_reminders",
  insights: "insights",
  card_statement_due: "card_statement_due",
  household_joined: "household_joined",
};

const PROFILE_PREFERENCE_COLUMN: Record<(typeof PROFILE_KINDS)[number], string> = {
  household_invite: "invite_received",
  app_update: "app_updates",
};

function isHouseholdKind(kind: Kind): kind is (typeof HOUSEHOLD_KINDS)[number] {
  return (HOUSEHOLD_KINDS as readonly string[]).includes(kind);
}

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
  const { householdId, profileIds, kind, title, body, url } = parsed.data;
  if (isHouseholdKind(kind) !== !!householdId) {
    // Un kind household-scoped SIEMPRE necesita householdId, y uno
    // profile-scoped nunca lo lleva — mezclar los dos modelos es un bug
    // del caller, no un caso a resolver "adivinando" cuál quiso decir.
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // E1 — resolver el llamador desde el JWT, nunca confiar en el body solo.
  // Tres callers legítimos:
  // (a) un cron/trigger de sistema (pg_cron+pg_net) con el propio
  //     `service_role` key como Bearer — máxima confianza, puede pedir
  //     cualquier modelo (household o profile-scoped, incluido broadcast).
  // (b) un usuario real pidiendo un household-scoped kind — se confirma
  //     que pertenece a ESE household, o cualquiera con un householdId
  //     ajeno (UUID v7, no secreto) podía mandar notificaciones arbitrarias.
  // (c) un usuario real pidiendo un profile-scoped kind SIN `profileIds`
  //     (broadcast) — reservado a `is_app_admin`. Con `profileIds` no hay
  //     caso de uso legítimo desde un usuario común hoy (los dos triggers
  //     que lo usan corren como sistema), así que queda cerrado a sistema.
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

    if (householdId) {
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
    } else if (kind === "app_update" && !profileIds) {
      const { data: callerProfile, error: profileError } = await admin.from("profiles").select("is_app_admin").eq("id", caller.id).maybeSingle();
      if (profileError) return internalError("admin check", profileError);
      if (!callerProfile?.is_app_admin) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
    } else {
      // household_invite, o un profile-scoped kind con `profileIds` — sin caso de uso de usuario real hoy.
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
  }

  let targetProfileIds: string[];

  if (householdId) {
    const { data: members, error: membersError } = await admin.from("household_members").select("profile_id").eq("household_id", householdId);
    if (membersError) return internalError("list members", membersError);

    const column = HOUSEHOLD_PREFERENCE_COLUMN[kind as (typeof HOUSEHOLD_KINDS)[number]];
    const { data: prefs, error: prefsError } = await admin.from("notification_preferences").select("profile_id").eq("household_id", householdId).eq(column, true);
    if (prefsError) return internalError("list opt-ins", prefsError);
    const optedInProfileIds = new Set((prefs ?? []).map((p) => p.profile_id));

    // Sin fila en notification_preferences = defaults (todo prendido, ver
    // `20260801080000...sql`) — solo se excluye a quien explícitamente apagó este tipo.
    const { data: explicitOptOuts, error: optOutsError } = await admin.from("notification_preferences").select("profile_id").eq("household_id", householdId).eq(column, false);
    if (optOutsError) return internalError("list opt-outs", optOutsError);
    const optedOutProfileIds = new Set((explicitOptOuts ?? []).map((p) => p.profile_id));

    const memberIds = new Set((members ?? []).map((m) => m.profile_id));
    targetProfileIds = (members ?? [])
      .map((m) => m.profile_id)
      .filter((id) => !optedOutProfileIds.has(id) || optedInProfileIds.has(id))
      .filter((id) => !profileIds || (profileIds.includes(id) && memberIds.has(id)));
  } else {
    const column = PROFILE_PREFERENCE_COLUMN[kind as (typeof PROFILE_KINDS)[number]];
    const candidateIds = profileIds ?? null;

    let candidates: string[];
    if (candidateIds) {
      candidates = candidateIds;
    } else {
      // Broadcast: todo perfil con al menos una suscripción activa.
      const { data: subscribed, error: subscribedError } = await admin.from("push_subscriptions").select("profile_id");
      if (subscribedError) return internalError("list subscribed profiles", subscribedError);
      candidates = [...new Set((subscribed ?? []).map((s) => s.profile_id))];
    }

    const { data: optOuts, error: optOutsError } = await admin.from("profile_notification_preferences").select("profile_id").in("profile_id", candidates).eq(column, false);
    if (optOutsError) return internalError("list profile opt-outs", optOutsError);
    const optedOutProfileIds = new Set((optOuts ?? []).map((p) => p.profile_id));
    targetProfileIds = candidates.filter((id) => !optedOutProfileIds.has(id));
  }

  const { data: subscriptions, error: subsError } =
    targetProfileIds.length === 0
      ? { data: [], error: null }
      : await admin.from("push_subscriptions").select("endpoint, p256dh, auth_key, profile_id").in("profile_id", targetProfileIds);
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
