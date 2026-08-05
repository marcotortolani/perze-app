import { Heading, Hr, Text } from "@react-email/components";
import { EmailButton } from "../components/EmailButton";
import { EmailLayout } from "../components/EmailLayout";
import { emailTheme } from "../theme";
import { authEmailCopy } from "./copy";

const copy = authEmailCopy.magicLink;

/**
 * Plantilla Go de Supabase Auth — tipo `magic_link`. Se exporta a
 * `supabase/templates/magic_link.html` vía `pnpm email:export` y se pega
 * a mano en el Dashboard (Authentication → Emails): `supabase config push`
 * la rechaza en plan free.
 *
 * Dos vías, como pide `docs/mejora-auth-oauth-y-email.md` § 0: el código
 * de 6 dígitos grande (`{{ .Token }}`, camino primario — se autocompleta
 * del teclado del sistema) y el link de un click como alternativa.
 * **Nunca `{{ .ConfirmationURL }}`**: ese cae en el flujo implícito con
 * los tokens en el fragment, que la app tolera solo como red de
 * seguridad. El destino es `/onboarding`, no `/onboarding/country` —
 * `resolveOnboardingDestination()` decide el paso real; mandar directo a
 * A4 duplicaba household en un reingreso desde otro dispositivo.
 *
 * `{{ .SiteURL }}` se usa también para el wordmark de arriba (dentro de
 * `EmailLayout`/`Wordmark`): es el mismo placeholder Go, sustituido por
 * GoTrue al enviar — así el logo resuelve siempre contra el dominio real
 * del deploy, sin depender de qué `NEXT_PUBLIC_SITE_URL` tenía quien
 * corrió el export.
 *
 * Los tres placeholders (`.Token`, `.TokenHash`, `.SiteURL`) se emiten
 * **literales**: no son props de este componente porque no hay props —
 * el consumidor de esta plantilla es GoTrue, no React. `templates.test.ts`
 * verifica que el export no los escape.
 */
export default function MagicLinkEmail() {
  const siteUrl = "{{ .SiteURL }}";
  return (
    <EmailLayout siteUrl={siteUrl} preview={copy.preview}>
      <Heading
        as="h2"
        style={{ margin: "0 0 8px", fontSize: 22, lineHeight: "28px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textPrimary }}
      >
        {copy.title}
      </Heading>
      <Text style={{ margin: "0 0 24px", fontSize: 16, lineHeight: "24px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textSecondary }}>
        {copy.body}
      </Text>
      <Text
        style={{
          margin: "0 0 24px",
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "8px",
          textAlign: "center",
          fontFamily: emailTheme.fontStackMono,
          color: emailTheme.color.textPrimary,
        }}
      >
        {"{{ .Token }}"}
      </Text>
      <EmailButton href={`${siteUrl}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding`}>{copy.buttonLabel}</EmailButton>
      <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />
      <Text style={{ margin: "0 0 16px", fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {copy.footerSecurity}
      </Text>
      <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {copy.footerPrivacy}
      </Text>
    </EmailLayout>
  );
}
