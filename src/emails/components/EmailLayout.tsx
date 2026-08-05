import { Body, Container, Head, Html, Preview, Section } from "@react-email/components";
import type { ReactNode } from "react";
import { emailTheme } from "../theme";
import { Wordmark } from "./Wordmark";

/**
 * Shell compartido de los tres emails de esta pasada (magic-link,
 * recovery, invitación). Card `--surface-1` sin sombra, padding lateral
 * 20px (`--screen-padding` de la app), radio 20px (`--radius-card`).
 */
export function EmailLayout({ siteUrl, preview, children }: { siteUrl: string; preview: string; children: ReactNode }) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: emailTheme.color.page, margin: 0, padding: "32px 0", fontFamily: emailTheme.fontStack }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
          <Section style={{ padding: "0 0 24px" }}>
            <Wordmark siteUrl={siteUrl} height={22} />
          </Section>
          <Section
            style={{
              backgroundColor: emailTheme.color.surface1,
              border: `1px solid ${emailTheme.color.border}`,
              borderRadius: emailTheme.radius.card,
              padding: 24,
            }}
          >
            {children}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
