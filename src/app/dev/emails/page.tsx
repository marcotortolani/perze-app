import { notFound } from "next/navigation";
import { render } from "@react-email/render";
import { env } from "@/env";
import MagicLinkEmail from "@/emails/auth/magic-link";
import RecoveryEmail from "@/emails/auth/recovery";

/**
 * Preview de los emails de Auth — solo en desarrollo. No instala el CLI
 * `react-email` (levanta su propio Next dentro del proyecto, riesgo
 * directo para `pnpm build`); esto renderiza server-side con el mismo
 * `render()` que usa `scripts/export-email-templates.mjs` y lo muestra en
 * un `iframe` — cero dependencias nuevas.
 *
 * Las plantillas de Auth no tienen props (las llena GoTrue con `{{ ... }}`
 * al enviar): para que el preview sea legible se reemplazan los
 * placeholders por valores de ejemplo, solo acá — el HTML que se exporta
 * a `supabase/templates/` sale de las mismas plantillas sin este reemplazo.
 */
export default async function EmailsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const templates = [
    { name: "magic_link", label: "Magic link / código (Auth)", Component: MagicLinkEmail },
    { name: "recovery", label: "Acceso de emergencia (Auth)", Component: RecoveryEmail },
  ];

  const rendered = await Promise.all(
    templates.map(async (t) => {
      const html = await render(t.Component(), { pretty: true });
      const withPreviewValues = html
        .replaceAll("{{ .SiteURL }}", siteUrl)
        .replaceAll("{{ .Token }}", "482913")
        .replaceAll("{{ .TokenHash }}", "preview-token-hash");
      return { ...t, html: withPreviewValues };
    })
  );

  return (
    <main style={{ padding: 32, display: "flex", flexDirection: "column", gap: 40 }}>
      <h1 className="t-title">Emails — PERZE</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)" }}>
        Placeholders Go reemplazados por valores de ejemplo solo en este preview. El export real
        (<code>pnpm email:export</code>) los deja literales para que GoTrue los sustituya.
      </p>
      {rendered.map((t) => (
        <section key={t.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="t-label">{t.label}</h2>
          <iframe
            title={t.label}
            srcDoc={t.html}
            style={{ width: "100%", maxWidth: 560, height: 640, border: "1px solid var(--border)", borderRadius: 12 }}
          />
        </section>
      ))}
    </main>
  );
}
