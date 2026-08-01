"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, ListRow, Sheet, StatusBadge } from "@/design-system";
import { APP_VERSION } from "@/lib/version";

/** K13 — acerca de. Licencia MIT ya decidida (`CLAUDE.md` § "Las tres últimas decisiones"), no "se está definiendo" como en el diseño original. */
export default function AboutPage() {
  const t = useTranslations();
  const router = useRouter();
  const [dataSheetOpen, setDataSheetOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("aboutPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 40, lineHeight: "44px", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text-primary)" }}>
          {t("aboutPage.name")}
        </div>
        <div className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("aboutPage.versionLine", { version: APP_VERSION })}
        </div>

        <div style={{ paddingTop: 28 }}>
          <ListRow label={t("aboutPage.sourceCode")} meta={t("aboutPage.sourceCodeMeta")} chevron={false} />
          <ListRow label={t("aboutPage.license")} meta="MIT" right={<StatusBadge status="good">{t("aboutPage.licenseBadge")}</StatusBadge>} chevron={false} />
          <ListRow label={t("aboutPage.dataStorage")} meta={t("aboutPage.dataStorageMeta")} onClick={() => setDataSheetOpen(true)} />
        </div>

        <div style={{ padding: "18px 4px 0" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("aboutPage.madeWith")}</div>
          <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 6 }}>{t("aboutPage.madeWithBody")}</p>
        </div>
      </div>

      <Sheet open={dataSheetOpen} title={t("aboutPage.dataStorage")} onClose={() => setDataSheetOpen(false)} height={360}>
        <p className="t-body" style={{ color: "var(--text-secondary)", margin: 0 }}>{t("aboutPage.dataStorageBody")}</p>
      </Sheet>
    </div>
  );
}
