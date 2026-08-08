import { NextResponse } from "next/server";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";
import InviteEmail from "@/emails/invite";
import { sendEmail } from "@/emails/send";
import messagesEs from "../../../../../messages/es.json";
import messagesEn from "../../../../../messages/en.json";
import messagesPt from "../../../../../messages/pt.json";

/**
 * J3 — dispara el mail de invitación. Route Handler, no Edge Function
 * (decisión cerrada, `docs/mejora-auth-oauth-y-email.md` § 6): esto corre
 * con la sesión del usuario que invita, no con `service_role`, así que no
 * hay motivo para salir del runtime de Next — mismo patrón que
 * `src/app/api/fx/route.ts`, que también hace su propio `getUser()`.
 *
 * `proxy.ts` excluye `/api/*` de su matcher — este handler se autentica
 * solo, no hereda ningún gate.
 */
const bodySchema = z.object({
  inviteId: z.uuid(),
  locale: z.enum(["es", "en", "pt"]),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MESSAGES: Record<"es" | "en" | "pt", Record<string, any>> = {
  es: messagesEs,
  en: messagesEn,
  pt: messagesPt,
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return jsonError("PARAMS_INVALIDOS", 400);
  const { inviteId, locale } = parsed.data;

  // RLS (`household_invites_select`) ya acota esto a household_id IN
  // current_households() — si la fila no aparece, o no existe o el
  // llamante no pertenece a ese household. Cualquiera de los dos casos es
  // un 404 opaco, nunca se distingue.
  const { data: invite, error: inviteError } = await supabase
    .from("household_invites")
    .select("id, household_id, code, email, role, expires_at, revoked_at, accepted_by")
    .eq("id", inviteId)
    .maybeSingle();
  if (inviteError) return jsonError("INTERNAL_ERROR", 500);
  if (!invite) return jsonError("NOT_FOUND", 404);

  // El destinatario sale de la fila, nunca del body — si no, esto es un
  // relay de spam abierto: cualquier sesión válida podría hacer que el
  // servidor mande mail a cualquier dirección.
  if (!invite.email) return jsonError("NO_RECIPIENT", 400);
  if (invite.accepted_by || invite.revoked_at || new Date(invite.expires_at) <= new Date()) {
    return jsonError("INVITE_NOT_SENDABLE", 400);
  }

  // Mismo umbral que `household_invites_insert` (owner/admin) — sólo
  // quien puede generar una invitación puede reenviarla por mail.
  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", invite.household_id)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return jsonError("INTERNAL_ERROR", 500);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return jsonError("FORBIDDEN", 403);
  }

  const [{ data: household, error: householdError }, { data: inviterProfile, error: profileError }] = await Promise.all([
    supabase.from("households").select("name").eq("id", invite.household_id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (householdError || profileError || !household) return jsonError("INTERNAL_ERROR", 500);

  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const inviterName = inviterProfile?.display_name || user.email || "";
  const messages = MESSAGES[locale];
  const t = createTranslator({ locale, messages, namespace: "emails.invite" });

  const result = await sendEmail({
    to: invite.email,
    subject: t("subject", { inviterName, householdName: household.name }),
    react: InviteEmail({
      locale,
      messages,
      siteUrl,
      householdName: household.name,
      inviterName,
      role: invite.role as "admin" | "member" | "viewer",
      code: invite.code,
      // `invite`, nunca `code` — proxy.ts secuestra cualquier `?code=` para el canje PKCE.
      inviteUrl: `${siteUrl}/join?invite=${invite.code}`,
    }),
  });

  if (!result.ok) {
    return jsonError(result.reason === "not_configured" ? "EMAIL_NOT_CONFIGURED" : "SEND_FAILED", result.reason === "not_configured" ? 503 : 502);
  }

  return NextResponse.json({}, { status: 200, headers: NO_STORE_HEADERS });
}
