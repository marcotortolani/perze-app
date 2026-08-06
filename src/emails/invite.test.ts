import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import InviteEmail, { type InviteEmailLocale } from "./invite";
import messagesEs from "../../messages/es.json";
import messagesEn from "../../messages/en.json";
import messagesPt from "../../messages/pt.json";

const MESSAGES: Record<InviteEmailLocale, Record<string, unknown>> = { es: messagesEs, en: messagesEn, pt: messagesPt };

const baseProps = {
  siteUrl: "https://perze.tortolani.cc",
  householdName: "Mi hogar",
  inviterName: "Ana",
  role: "member" as const,
  code: "AB2CD3EFGHJ",
  inviteUrl: "https://perze.tortolani.cc/join?invite=AB2CD3EFGHJ",
};

describe.each(["es", "en", "pt"] as const)("InviteEmail — locale %s", (locale) => {
  it("incluye el household, el link con ?invite= (nunca ?code=) y el código", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = await render(InviteEmail({ locale, messages: MESSAGES[locale] as any, ...baseProps }));
    expect(html).toContain("Mi hogar");
    expect(html).toContain("?invite=AB2CD3EFGHJ");
    expect(html).not.toContain("?code=AB2CD3EFGHJ");
    expect(html).toContain("AB2CD3EFGHJ");
  });

  it("no usa CSS vars ni color-mix", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = await render(InviteEmail({ locale, messages: MESSAGES[locale] as any, ...baseProps }));
    expect(html).not.toContain("var(--");
    expect(html).not.toContain("color-mix(");
  });
});
