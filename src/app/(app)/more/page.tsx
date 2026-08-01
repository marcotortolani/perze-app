"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card, ListRow, Sheet, StatusBadge } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useConflicts } from "@/hooks/use-conflicts";
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
  const { conflicts } = useConflicts(household?.id);
  const modules = household?.enabledModules ?? [];
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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
          {modules.includes("budgets") ? <ListRow icon="target" label={t("morePage.budgets")} onClick={() => router.push("/budgets")} /> : null}
          {modules.includes("goals") ? <ListRow icon="flag" label={t("morePage.goals")} onClick={() => router.push("/goals")} /> : null}
          {modules.includes("recurring") ? <ListRow icon="refresh" label={t("morePage.recurring")} onClick={() => router.push("/recurring")} /> : null}
          {modules.includes("debts") ? <ListRow icon="handshake" label={t("morePage.debts")} onClick={() => router.push("/debts")} /> : null}
          {modules.includes("investments") ? <ListRow icon="invest" label={t("nav.investments")} onClick={() => router.push("/investments")} /> : null}
          <ListRow icon="tag" label={t("morePage.categories")} onClick={() => router.push("/more/categories")} />
          <ListRow icon="tag" label={t("morePage.tagsAndPayees")} onClick={() => router.push("/more/tags")} />
          <ListRow icon="refresh" label={t("morePage.rules")} onClick={() => router.push("/more/rules")} />
        </Card>
      </section>

      {modules.includes("family") ? (
        <section>
          <div style={CAPTION_STYLE}>{t("morePage.people")}</div>
          <Card padding="4px 16px">
            <ListRow icon="users" label={t("morePage.family")} onClick={() => router.push("/family")} />
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
          <ListRow icon="user" label={t("morePage.profile")} onClick={() => router.push("/more/profile")} />
          <ListRow icon="lock" label={t("morePage.security")} onClick={() => router.push("/more/security")} />
          <ListRow icon="alert" label={t("notificationsPage.title")} onClick={() => router.push("/more/notifications")} />
          <ListRow
            icon="refresh"
            label={t("conflictsPage.title")}
            chevron
            value={conflicts.length > 0 ? <StatusBadge status="critical">{t("conflictsPage.badgeCount", { count: conflicts.length })}</StatusBadge> : undefined}
            onClick={() => router.push("/more/conflicts")}
          />
          <ListRow icon="refresh" label={t("syncDiagnosticsPage.title")} onClick={() => router.push("/more/sync")} />
          <ListRow icon="edit" label={t("morePage.settings")} onClick={() => router.push("/more/settings")} />
          <ListRow icon="install" label={t("morePage.importExport")} onClick={() => router.push("/more/export")} />
          <ListRow icon="install" label={t("importCsvPage.title")} onClick={() => router.push("/more/import")} />
          <ListRow icon="mail" label={t("morePage.about")} onClick={() => router.push("/more/about")} />
        </Card>
      </section>

      <Card padding="4px 16px">
        <ListRow icon="plus" label={t("morePage.enableMoreFeatures")} variant="action" onClick={() => router.push("/more/modules")} />
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
