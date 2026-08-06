import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";

/**
 * D35 — el único caller de `send-push` en modo broadcast (`kind:
 * "app_update"`, sin `householdId` ni `profileIds`) que no es un
 * cron/trigger de sistema. Route Handler, no Edge Function — corre con la
 * sesión del operador, nunca con `service_role` (`CLAUDE.md`): se reenvía
 * el propio access token del operador a `send-push`, que es quien de
 * verdad decide si puede (`profiles.is_app_admin`) — este 403 acá es solo
 * para no ni siquiera intentar el fetch si obviamente no puede.
 */
const bodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
});

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

  const { data: profile, error: profileError } = await supabase.from("profiles").select("is_app_admin").eq("id", user.id).maybeSingle();
  if (profileError) return jsonError("INTERNAL_ERROR", 500);
  if (!profile?.is_app_admin) return jsonError("FORBIDDEN", 403);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return jsonError("PARAMS_INVALIDOS", 400);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return jsonError("UNAUTHENTICATED", 401);

  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "app_update", title: parsed.data.title, body: parsed.data.body }),
  });
  if (!res.ok) return jsonError("SEND_FAILED", 502);

  const result = (await res.json()) as { sent: number; failed: number };
  return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
}
