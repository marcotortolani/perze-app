import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import MagicLinkEmail from "./magic-link";
import RecoveryEmail from "./recovery";

/**
 * Las plantillas de Auth de Supabase se pegan a mano en el Dashboard
 * (`supabase config push` las rechaza en plan free) — `supabase/templates/
 * *.html` es la fuente de verdad de lo que *debería* estar pegado.
 * Este test es el guardarraíl de "me olvidé de correr `pnpm email:export`
 * después de tocar el TSX": si diverge, falla acá y no en producción.
 */
const TEMPLATES_DIR = path.resolve(__dirname, "../../../supabase/templates");

const GENERATED_HEADER = `<!--
  Generado por \`pnpm email:export\` desde \`src/emails/auth/*.tsx\`.
  No editar a mano — el próximo export lo pisa sin avisar. Para cambiar
  el contenido, editar el componente React y volver a correr el script.
-->
`;

async function renderComponent(Component: () => ReactElement) {
  return render(Component(), { pretty: true });
}

describe.each([
  // recovery es solo-link (§ decisión: "link de acceso de emergencia", no
  // un `verifyOtp` a mano) — no lleva el código de 6 dígitos de `.Token`.
  { name: "magic_link", Component: MagicLinkEmail, file: "magic_link.html", hasTokenCode: true },
  { name: "recovery", Component: RecoveryEmail, file: "recovery.html", hasTokenCode: false },
])("plantilla de Auth: $name", ({ Component, file, hasTokenCode }) => {
  it("emite los placeholders Go literales, sin escapar", async () => {
    const html = await renderComponent(Component);
    if (hasTokenCode) expect(html).toContain("{{ .Token }}");
    expect(html).toContain("{{ .TokenHash }}");
    expect(html).toContain("{{ .SiteURL }}");
    // Nunca el flujo implícito con tokens en el fragment.
    expect(html).not.toContain(".ConfirmationURL");
  });

  it("no usa CSS vars ni color-mix — no sobreviven en un cliente de mail", async () => {
    const html = await renderComponent(Component);
    expect(html).not.toContain("var(--");
    expect(html).not.toContain("color-mix(");
  });

  it("apunta a /onboarding, no a /onboarding/profile (evita duplicar household en un reingreso)", async () => {
    const html = await renderComponent(Component);
    expect(html).toContain("next=/onboarding");
    expect(html).not.toContain("next=/onboarding/profile");
  });

  it("coincide con el HTML commiteado en supabase/templates/ — correr `pnpm email:export` si falla", async () => {
    const rendered = GENERATED_HEADER + (await renderComponent(Component));
    const committed = readFileSync(path.join(TEMPLATES_DIR, file), "utf-8");
    expect(rendered).toBe(committed);
  });
});
