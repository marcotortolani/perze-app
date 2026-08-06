import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { describe, expect, it, vi } from "vitest";

/**
 * Espejo de `src/app/api/fx/route.test.ts` (B5): un mock mínimo del
 * cliente de Supabase que modela cada `.from(table)` como un builder
 * encadenable resolviendo al `result` configurado para esa tabla.
 */
function makeSupabaseMock(opts: { user: { id: string; email?: string } | null; tableResults?: Record<string, { data: unknown; error: unknown }> }) {
  const tableResults = opts.tableResults ?? {};

  function builderFor(table: string) {
    const result = tableResults[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  }

  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from: (table: string) => builderFor(table),
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/emails/send", () => ({ sendEmail: vi.fn() }));
// El route handler carga `@/env` directo (para NEXT_PUBLIC_SITE_URL); sin
// mockear, `createEnv()` valida en el import y explota sin `.env.local`
// real, como ya documenta `src/lib/offline/hydrate.test.ts:3-5`.
vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_SITE_URL: "https://test.perze.example" } }));

const VALID_INVITE = { id: "inv-1", household_id: "h1", code: "AB2CD3EFGHJ", email: "ana@example.com", role: "member", expires_at: "2999-01-01T00:00:00Z", revoked_at: null, accepted_by: null };
const VALID_BODY = { inviteId: "63aff884-fb09-4003-b630-14c388ba7273", locale: "es" };

describe("POST /api/emails/invite", () => {
  it("401 sin sesión", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({ user: null }) as never);
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify(VALID_BODY) }));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHENTICATED");
  });

  it("400 con body inválido", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({ user: { id: "u1" } }) as never);
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify({ inviteId: "no-es-uuid" }) }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("PARAMS_INVALIDOS");
  });

  it("404 cuando la invitación no aparece (ajena o inexistente — RLS ya lo distingue)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({ user: { id: "u1" }, tableResults: { household_invites: { data: null, error: null } } }) as never
    );
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify(VALID_BODY) }));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("NOT_FOUND");
  });

  it("403 si el llamante no es owner/admin del household", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: {
          household_invites: { data: VALID_INVITE, error: null },
          household_members: { data: { role: "member" }, error: null },
        },
      }) as never
    );
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify(VALID_BODY) }));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("FORBIDDEN");
  });

  it("400 si la invitación ya fue aceptada, revocada o venció", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: { household_invites: { data: { ...VALID_INVITE, expires_at: "2000-01-01T00:00:00Z" }, error: null } },
      }) as never
    );
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify(VALID_BODY) }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVITE_NOT_SENDABLE");
  });

  it("503 si Resend no está configurado — el código sigue siendo el camino de respaldo", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { sendEmail } = await import("@/emails/send");
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, reason: "not_configured" });
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1", email: "owner@example.com" },
        tableResults: {
          household_invites: { data: VALID_INVITE, error: null },
          household_members: { data: { role: "owner" }, error: null },
          households: { data: { name: "Mi hogar" }, error: null },
          profiles: { data: { display_name: "Owner" }, error: null },
        },
      }) as never
    );
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify(VALID_BODY) }));

    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("200 y el link usa ?invite=, nunca ?code=", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { sendEmail } = await import("@/emails/send");
    vi.mocked(sendEmail).mockResolvedValue({ ok: true });
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1", email: "owner@example.com" },
        tableResults: {
          household_invites: { data: VALID_INVITE, error: null },
          household_members: { data: { role: "owner" }, error: null },
          households: { data: { name: "Mi hogar" }, error: null },
          profiles: { data: { display_name: "Owner" }, error: null },
        },
      }) as never
    );
    const { POST } = await import("./route");

    const res = await POST(new Request("http://localhost/api/emails/invite", { method: "POST", body: JSON.stringify(VALID_BODY) }));

    expect(res.status).toBe(200);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.to).toBe("ana@example.com");
    const html = await render(call?.react as ReactElement);
    expect(html).toContain("?invite=AB2CD3EFGHJ");
    expect(html).not.toContain("?code=AB2CD3EFGHJ");
  });
});
