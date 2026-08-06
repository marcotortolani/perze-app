"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListRow, Sheet, usePageHeader } from "@/design-system";
import { APP_VERSION } from "@/lib/version";

/** K13 — acerca de. Licencia MIT ya decidida (`CLAUDE.md` § "Las tres últimas decisiones"), no "se está definiendo" como en el diseño original. */
export default function AboutPage() {
  const t = useTranslations();
  const router = useRouter();
  const [dataSheetOpen, setDataSheetOpen] = useState(false);
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  usePageHeader({ title: t("aboutPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 40, lineHeight: "44px", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text-primary)" }}>
          {t("aboutPage.name")}
        </div>
        <div className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("aboutPage.versionLine", { version: APP_VERSION })}
        </div>

        <div style={{ paddingTop: 28 }}>
          <ListRow icon="refresh" label={t("aboutPage.changelog")} meta={t("aboutPage.changelogMeta")} onClick={() => router.push("/more/changelog")} />
          <ListRow label={t("aboutPage.dataStorage")} meta={t("aboutPage.dataStorageMeta")} onClick={() => setDataSheetOpen(true)} />
          <ListRow label={t("aboutPage.operatorVisibility")} meta={t("aboutPage.operatorVisibilityMeta")} onClick={() => setPrivacySheetOpen(true)} />
          <ListRow label={t("aboutPage.currencyStandard")} meta={t("aboutPage.currencyStandardMeta")} onClick={() => setCurrencySheetOpen(true)} />
        </div>

        <div style={{ padding: "18px 4px 0" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("aboutPage.madeWith")}</div>
          <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 6 }}>{t("aboutPage.madeWithBody")}</p>
        </div>
      </div>

      {/* Detalle al pie de la pantalla, no del viewport: `marginTop: "auto"`
          empuja este bloque contra el fondo del flex column de altura
          100% de esta pantalla cuando sobra espacio (lo normal, es poco
          contenido) — nunca `position: fixed`/`bottom: 0`, que lo pegaría
          al borde real de la ventana por encima de cualquier otra cosa.
          Si el contenido de arriba llega a no entrar en una pantalla muy
          baja, este bloque simplemente sigue el flujo normal y se scrollea
          con el resto, en vez de solaparse. Sin `ListRow` ni `Card` — una
          cita no es un dato de la app. Borde izquierdo fino (mismo patrón
          que ya usa `CategoryTemplatePreview` para citar contenido
          subordinado), cursiva reservada a esta única línea de cuerpo de
          texto — nunca en un título — y el nombre en tinta muted, no de
          marca: es una firma, no una acción. */}
      <div style={{ marginTop: "auto", paddingLeft: 16, paddingBottom: 24, borderLeft: "2px solid var(--border)" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 15, fontStyle: "italic", lineHeight: 1.5, color: "var(--text-secondary)" }}>
          {t("aboutPage.quote")}
        </p>
        <p className="t-caption" style={{ margin: "10px 0 0", color: "var(--text-muted)" }}>
          {t("aboutPage.quoteAuthor")}
        </p>
      </div>

      <Sheet open={dataSheetOpen} title={t("aboutPage.dataStorage")} onClose={() => setDataSheetOpen(false)} height={360}>
        <p className="t-body" style={{ color: "var(--text-secondary)", margin: 0 }}>{t("aboutPage.dataStorageBody")}</p>
      </Sheet>

      <Sheet open={privacySheetOpen} title={t("aboutPage.operatorVisibility")} onClose={() => setPrivacySheetOpen(false)} height={360}>
        <div className="t-body" style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0 }}>{t("privacyNotice.who")}</p>
          <p style={{ margin: 0 }}>{t("privacyNotice.sees")}</p>
          <p style={{ margin: 0 }}>{t("privacyNotice.neverSees")}</p>
          <p style={{ margin: 0 }}>{t("privacyNotice.noThirdParty")}</p>
        </div>
      </Sheet>

      <Sheet open={currencySheetOpen} title={t("aboutPage.currencyStandard")} onClose={() => setCurrencySheetOpen(false)} height={360}>
        <div className="t-body" style={{ color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0 }}>{t("aboutPage.currencyStandardBody1")}</p>
          <p style={{ margin: 0 }}>{t("aboutPage.currencyStandardBody2")}</p>
        </div>
      </Sheet>
    </div>
  );
}
