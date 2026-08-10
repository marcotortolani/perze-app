// Resumen del período que cerró, por miembro
// (`docs/resumen-mensual-por-mail.md`, paso 4).
//
// **Esta función no calcula nada de dinero, y es a propósito.** Lee las
// filas que cada miembro puede ver —con `service_role`, que `CLAUDE.md`
// solo permite acá y en cron— y se las postea a `/api/emails/monthly-summary`,
// que corre el mismo TypeScript que las pantallas (`buildMonthlySummary`).
// Duplicar la agregación en Deno es el camino que ya salió caro con
// `daily-fx-sync`, cuyo set de monedas quedó en 14 mientras el del cliente
// tenía 30 y nadie se enteró; acá el modo de falla sería un mail cuyos
// números no coinciden con la app.
//
// No decide CUÁNDO —eso lo dispara `trigger_monthly_summaries()`, que sabe
// qué hogares cerraron período— pero sí decide QUIÉN: la preferencia y la
// idempotencia se resuelven acá porque acá se sabe si el mail salió bien.
// El cron es fire-and-forget (`net.http_post` no espera respuesta) y no
// podría marcar nada como enviado sin mentir.
//
// Deploy: `supabase functions deploy monthly-summary`
// Secrets: `SUMMARY_ENDPOINT` (o `SITE_URL`) y `MONTHLY_SUMMARY_SECRET`,
// el mismo valor que la variable de entorno de Next.
//
// Sin CORS ni handler de OPTIONS, mismo criterio que `notify-invite-accepted`:
// esto es server-to-server, nunca el navegador de nadie.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const requestSchema = z.object({
  householdId: z.uuid(),
  /** Primer día del período que cerró. */
  periodStart: z.iso.date(),
  /** Último día INCLUSIVE del período que cerró. */
  periodEnd: z.iso.date(),
  /** Primer día del período anterior — su fin es `periodStart`. */
  previousPeriodStart: z.iso.date(),
  /** Si viene, solo estos miembros. Por defecto, todos los activos. */
  profileIds: z.array(z.uuid()).optional(),
  /** Arma los payloads y los devuelve sin mandar un solo mail. */
  dryRun: z.boolean().optional(),
});

interface SummaryTransactionRow {
  kind: string;
  amount_base: string | null;
  occurred_at: string;
  category_id: string | null;
  category_name: string | null;
}

interface SummaryBalanceRow {
  account_id: string;
  name: string;
  currency_code: string;
  opening: string;
  closing: string;
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

/** Nunca se devuelve el detalle de Postgres al invocador — log interno, respuesta opaca. */
function internalError(context: string, error: unknown): Response {
  console.error(`[monthly-summary] ${context}:`, error);
  return jsonError("internal_error", 500);
}

/**
 * Los límites del cálculo son instantes UTC: `[from, to)` con `periodEnd`
 * inclusive, así que el corte cae el día siguiente a las 00:00 UTC.
 *
 * El hogar no guarda huso horario (decisión cerrada: la app lee el del
 * dispositivo), así que UTC es el único corte defendible del lado
 * servidor. **La ruta de Next vuelve a recortar con exactamente el mismo
 * criterio** — si acá se corriera un día, el recorte de allá tiraría filas
 * que sí viajaron.
 */
function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonError("method_not_allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const summarySecret = Deno.env.get("MONTHLY_SUMMARY_SECRET");
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://perze.tortolani.cc";
  const endpoint = Deno.env.get("SUMMARY_ENDPOINT") ?? `${siteUrl}/api/emails/monthly-summary`;
  if (!supabaseUrl || !serviceRoleKey) return internalError("missing Supabase env", new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY"));

  const bearerToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (bearerToken !== serviceRoleKey) return jsonError("unauthenticated", 401);

  // Sin secreto compartido la ruta de Next devuelve 404 a todo: mejor no
  // salir a pegarle y decirlo acá.
  if (!summarySecret) {
    console.log("[monthly-summary] MONTHLY_SUMMARY_SECRET sin configurar — sin enviar");
    return new Response(JSON.stringify({ sent: 0, reason: "not_configured" }), { headers: { "Content-Type": "application/json" } });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) return jsonError("invalid_body", 400);
  const { householdId, periodStart, periodEnd, previousPeriodStart, profileIds, dryRun } = parsed.data;

  const from = `${periodStart}T00:00:00.000Z`;
  const to = dayAfter(periodEnd);
  const previousFrom = `${previousPeriodStart}T00:00:00.000Z`;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: household, error: householdError } = await admin
    .from("households")
    .select("base_currency, deleted_at")
    .eq("id", householdId)
    .maybeSingle();
  if (householdError) return internalError("read household", householdError);
  if (!household || household.deleted_at) return jsonError("household_not_found", 404);

  let membersQuery = admin.from("household_members").select("profile_id").eq("household_id", householdId).eq("status", "active");
  if (profileIds && profileIds.length > 0) membersQuery = membersQuery.in("profile_id", profileIds);
  const { data: members, error: membersError } = await membersQuery;
  if (membersError) return internalError("list members", membersError);
  if (!members || members.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  // Quien nunca tocó la preferencia no tiene fila: el default es recibirlo,
  // igual que la columna. Solo un `false` explícito lo apaga.
  const { data: preferences, error: preferencesError } = await admin
    .from("notification_preferences")
    .select("profile_id, monthly_summary_email")
    .eq("household_id", householdId);
  if (preferencesError) return internalError("read preferences", preferencesError);
  const optedOut = new Set((preferences ?? []).filter((row) => row.monthly_summary_email === false).map((row) => row.profile_id));

  const results: { profileId: string; status: string }[] = [];

  // En serie y no en paralelo: son pocos miembros por hogar y el cron
  // recorre muchos hogares. Abrir N conexiones a la vez contra la ruta de
  // Next y contra Resend no acelera nada que importe y sí multiplica el
  // rate limit.
  for (const member of members) {
    const profileId = member.profile_id;

    if (optedOut.has(profileId)) {
      results.push({ profileId, status: "opted_out" });
      continue;
    }

    const { data: user, error: userError } = await admin.auth.admin.getUserById(profileId);
    if (userError) {
      console.error("[monthly-summary] read member email:", userError);
      results.push({ profileId, status: "email_error" });
      continue;
    }
    const email = user.user?.email;
    // Sin mail verificado no se manda: un resumen financiero a una casilla
    // sin confirmar es exactamente el mail que no hay que mandar.
    if (!email || !user.user?.email_confirmed_at) {
      results.push({ profileId, status: "no_email" });
      continue;
    }

    const { data: profile } = await admin.from("profiles").select("locale").eq("id", profileId).maybeSingle();
    const locale = profile?.locale === "en" || profile?.locale === "pt" ? profile.locale : "es";

    const [transactions, previousTransactions, balances] = await Promise.all([
      admin.rpc("summary_transactions", { p_household_id: householdId, p_viewer: profileId, p_from: from, p_to: to }),
      admin.rpc("summary_transactions", { p_household_id: householdId, p_viewer: profileId, p_from: previousFrom, p_to: from }),
      admin.rpc("summary_account_balances", { p_household_id: householdId, p_viewer: profileId, p_from: from, p_to: to }),
    ]);
    const readError = transactions.error ?? previousTransactions.error ?? balances.error;
    if (readError) {
      console.error("[monthly-summary] read rows:", readError);
      results.push({ profileId, status: "read_error" });
      continue;
    }

    const payload = {
      to: email,
      locale,
      baseCurrency: household.base_currency,
      periodStart,
      periodEnd,
      previousPeriodStart,
      accounts: (balances.data as SummaryBalanceRow[]).map((row) => ({
        name: row.name,
        currencyCode: row.currency_code,
        opening: row.opening,
        closing: row.closing,
      })),
      transactions: (transactions.data as SummaryTransactionRow[]).map((row) => ({
        kind: row.kind,
        amountBase: row.amount_base,
        occurredAt: row.occurred_at,
        categoryId: row.category_id,
        categoryName: row.category_name,
      })),
      previousTransactions: (previousTransactions.data as SummaryTransactionRow[]).map((row) => ({
        kind: row.kind,
        amountBase: row.amount_base,
        occurredAt: row.occurred_at,
      })),
    };

    if (dryRun) {
      results.push({ profileId, status: "dry_run" });
      console.log(`[monthly-summary] dry run ${profileId}: ${payload.transactions.length} movimientos, ${payload.accounts.length} cuentas`);
      continue;
    }

    // Se RESERVA el envío antes de mandarlo, y se libera si falla.
    //
    // El diseño decía "insertar después del envío exitoso", pero entre el
    // chequeo y el envío hay una carrera: el cron reintenta durante cuatro
    // días y dos corridas solapadas mandarían el mismo resumen dos veces.
    // Reservar primero cierra la carrera con el `UNIQUE`, y el `delete` de
    // más abajo preserva lo que esa regla protegía: que un fallo de red no
    // deje a alguien sin resumen para siempre.
    const { error: claimError } = await admin.from("summary_emails_sent").insert({
      household_id: householdId,
      profile_id: profileId,
      kind: "monthly",
      period_start: periodStart,
      period_end: periodEnd,
    });
    if (claimError) {
      // 23505 = ya lo recibió (una corrida anterior de la ventana de
      // reintento). Es el caso normal, no un error.
      if (claimError.code === "23505") {
        results.push({ profileId, status: "already_sent" });
      } else {
        console.error("[monthly-summary] claim:", claimError);
        results.push({ profileId, status: "claim_error" });
      }
      continue;
    }

    const releaseClaim = async () => {
      const { error } = await admin
        .from("summary_emails_sent")
        .delete()
        .match({ household_id: householdId, profile_id: profileId, kind: "monthly", period_start: periodStart });
      // Si ni siquiera se puede liberar, ese miembro pierde el resumen de
      // este período. Queda logueado para poder borrar la fila a mano.
      if (error) console.error("[monthly-summary] release claim:", error);
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-perze-summary-secret": summarySecret },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("[monthly-summary] post to Next:", error);
      await releaseClaim();
      results.push({ profileId, status: "network_error" });
      continue;
    }

    if (!response.ok) {
      console.error(`[monthly-summary] Next respondió ${response.status} para ${profileId}`);
      await releaseClaim();
      results.push({ profileId, status: `http_${response.status}` });
      continue;
    }

    // 200 con `sent: false` es un período sin movimientos. La reserva se
    // MANTIENE: no es un fallo, es un resumen resuelto, y liberarla haría
    // que el cron lo reintentara los tres días siguientes para volver a
    // descubrir que no hay nada que contar.
    const body = (await response.json().catch(() => ({}))) as { sent?: boolean; reason?: string };
    results.push({ profileId, status: body.sent === false ? (body.reason ?? "not_sent") : "sent" });
  }

  return new Response(JSON.stringify({ sent: results.filter((r) => r.status === "sent").length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
