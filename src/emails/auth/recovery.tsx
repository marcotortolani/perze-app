import { Heading, Hr, Text } from "@react-email/components";
import { EmailButton } from "../components/EmailButton";
import { EmailLayout } from "../components/EmailLayout";
import { emailTheme } from "../theme";
import { authEmailCopy } from "./copy";

const copy = authEmailCopy.recovery;

/**
 * Plantilla Go de Supabase Auth — tipo `recovery`. Se exporta a
 * `supabase/templates/recovery.html` con el mismo flujo que
 * `magic-link.tsx`.
 *
 * `CLAUDE.md` y el diseño de A2 son categóricos: sin contraseñas, ni acá
 * ni nunca. Este mail **no es un "olvidé mi contraseña"** — ese flujo se
 * borró (`docs/mejora-auth-oauth-y-email.md` § 0.1, reversión). Es un
 * **link de acceso de emergencia**, disparable solo a mano desde el
 * Dashboard de Supabase (Authentication → Users → "Send recovery"), para
 * el caso límite en que el OTP normal falle y el operador necesite
 * reponerse acceso a su propia instancia. `type=recovery` ya lo canjea
 * `src/app/auth/callback/route.ts` con el mismo `verifyOtp`/PKCE que el
 * resto — no hace falta código nuevo del lado de la app.
 */
export default function RecoveryEmail() {
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
      <EmailButton href={`${siteUrl}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/onboarding`}>{copy.buttonLabel}</EmailButton>
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
