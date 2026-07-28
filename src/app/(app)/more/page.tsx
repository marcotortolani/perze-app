"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Card, ListRow, Sheet } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { APP_VERSION } from "@/lib/version";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/formatting";

const LANGUAGE_MESSAGE_KEY = {
  es: "morePage.languageNames.es",
  en: "morePage.languageNames.en",
  pt: "morePage.languageNames.pt",
} as const;

const CAPTION_STYLE = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  lineHeight: "16px",
  fontWeight: 600,
  letterSpacing: ".08em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
  padding: "0 4px 4px",
};

/** Índice de secciones (B7) — Bloque B, Fase 6. Los módulos apagados no aparecen. */
export default function MorePage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const modules = household?.enabledModules ?? [];
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const comingSoon = (label: string) => toast(t("morePage.comingSoon", { label }));

  const handleSelectLocale = (next: Locale) => {
    if (next === locale) {
      setLanguageSheetOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocale(next);
      setLanguageSheetOpen(false);
      router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8, paddingBottom: 24 }}>
      <section>
        <div style={CAPTION_STYLE}>{t("morePage.money")}</div>
        <Card padding="4px 16px">
          <ListRow icon="wallet" label={t("morePage.accounts")} onClick={() => router.push("/accounts")} />
          {modules.includes("budgets") ? <ListRow icon="target" label={t("morePage.budgets")} onClick={() => comingSoon(t("morePage.budgets"))} /> : null}
          {modules.includes("goals") ? <ListRow icon="flag" label={t("morePage.goals")} onClick={() => comingSoon(t("morePage.goals"))} /> : null}
          {modules.includes("recurring") ? <ListRow icon="refresh" label={t("morePage.recurring")} onClick={() => comingSoon(t("morePage.recurring"))} /> : null}
          {modules.includes("debts") ? <ListRow icon="handshake" label={t("morePage.debts")} onClick={() => comingSoon(t("morePage.debts"))} /> : null}
        </Card>
      </section>

      {modules.includes("family") ? (
        <section>
          <div style={CAPTION_STYLE}>{t("morePage.people")}</div>
          <Card padding="4px 16px">
            <ListRow icon="users" label={t("morePage.family")} onClick={() => comingSoon(t("morePage.family"))} />
          </Card>
        </section>
      ) : null}

      <section>
        <div style={CAPTION_STYLE}>{t("morePage.system")}</div>
        <Card padding="4px 16px">
          <ListRow
            icon="globe"
            label={t("morePage.language")}
            value={t(LANGUAGE_MESSAGE_KEY[locale])}
            variant="value"
            onClick={() => setLanguageSheetOpen(true)}
          />
          <ListRow icon="edit" label={t("morePage.settings")} onClick={() => comingSoon(t("morePage.settings"))} />
          <ListRow icon="install" label={t("morePage.importExport")} onClick={() => comingSoon(t("morePage.importExport"))} />
          <ListRow icon="mail" label={t("morePage.about")} onClick={() => comingSoon(t("morePage.about"))} />
        </Card>
      </section>

      <Card padding="4px 16px">
        <ListRow icon="plus" label={t("morePage.enableMoreFeatures")} variant="action" onClick={() => comingSoon(t("morePage.enableMoreFeatures"))} />
      </Card>

      <p className="t-caption" style={{ textAlign: "center", color: "var(--text-muted)" }}>
        {t("morePage.version", { version: APP_VERSION })}
      </p>

      <Sheet open={languageSheetOpen} title={t("morePage.languageSheetTitle")} onClose={() => setLanguageSheetOpen(false)} height={280}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {routing.locales.map((candidate) => (
            <ListRow
              key={candidate}
              label={t(LANGUAGE_MESSAGE_KEY[candidate])}
              variant="value"
              value={candidate === locale ? "✓" : undefined}
              disabled={pending}
              onClick={() => handleSelectLocale(candidate)}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
