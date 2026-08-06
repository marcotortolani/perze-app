import { Heading, Hr, Text } from "@react-email/components";
import { createTranslator } from "next-intl";
import { EmailButton } from "./components/EmailButton";
import { EmailLayout } from "./components/EmailLayout";
import { emailTheme } from "./theme";

export type InviteEmailLocale = "es" | "en" | "pt";

export type InviteEmailProps = {
  locale: InviteEmailLocale;
  // `next-intl`/`use-intl` necesita `Record<string, any>` (no `unknown`)
  // para poder inferir las claves anidadas de `NestedKeyOf` — con
  // `unknown` la inferencia de `createTranslator` colapsa a `never` en
  // cada `t(...)` de abajo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Record<string, any>;
  siteUrl: string;
  householdName: string;
  inviterName: string;
  role: "admin" | "member" | "viewer";
  code: string;
  inviteUrl: string;
};

/**
 * J3 — invitación al household. La única de las tres plantillas de esta
 * pasada con i18n real: la manda la propia app (`src/app/api/emails/invite/route.ts`),
 * no GoTrue, así que puede usar el locale de quien invita
 * (`src/i18n/request.ts`, cookie `perze_locale`) — a diferencia de las de
 * Auth (`src/emails/auth/*.tsx`), que van en español fijo porque el
 * Dashboard de Supabase no tiene noción de locale por plantilla.
 *
 * Contenido alineado con J3 (`docs/design/bloque-j-familiar.html:92-123`):
 * quién invita, a qué household, el rol explicado en una línea, el link
 * primario y el código como camino alternativo (se dicta por teléfono).
 * `inviteUrl` usa `?invite=`, no `?code=` — `src/proxy.ts:55-59` secuestra
 * cualquier `?code=` para el canje PKCE de Supabase.
 */
export default function InviteEmail({ locale, messages, siteUrl, householdName, inviterName, role, code, inviteUrl }: InviteEmailProps) {
  const t = createTranslator({ locale, messages, namespace: "emails.invite" });

  return (
    <EmailLayout siteUrl={siteUrl} preview={t("preview", { inviterName })}>
      <Heading
        as="h2"
        style={{ margin: "0 0 8px", fontSize: 22, lineHeight: "28px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textPrimary }}
      >
        {t("title", { householdName })}
      </Heading>
      <Text style={{ margin: "0 0 24px", fontSize: 16, lineHeight: "24px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textSecondary }}>
        {t("body", { inviterName, householdName })}
      </Text>

      <Text style={{ margin: "0 0 4px", fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {t("roleLabel")}
      </Text>
      <Text style={{ margin: "0 0 24px", fontSize: 16, lineHeight: "24px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textPrimary }}>
        {t(`roleDescriptions.${role}`, { inviterName })}
      </Text>

      <EmailButton href={inviteUrl}>{t("buttonLabel")}</EmailButton>

      <Hr style={{ margin: "24px 0", borderColor: emailTheme.color.border }} />

      <Text style={{ margin: "0 0 4px", fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {t("codeLabel")}
      </Text>
      <Text
        style={{
          margin: "0 0 16px",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "4px",
          fontFamily: emailTheme.fontStackMono,
          color: emailTheme.color.textPrimary,
        }}
      >
        {code}
      </Text>

      <Text style={{ margin: "0 0 8px", fontSize: 13, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {t("expiresNote")}
      </Text>
      <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", fontFamily: emailTheme.fontStack, color: emailTheme.color.textMuted }}>
        {t("footer")}
      </Text>
    </EmailLayout>
  );
}
