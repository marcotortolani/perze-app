"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, usePageHeader } from "@/design-system";
import type { PublicChangelogEntry } from "@/lib/changelog/parse-public-changelog";

const GROUP_LABEL_STYLE = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  lineHeight: "16px",
  fontWeight: 600,
  letterSpacing: ".06em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
};

export interface ChangelogContentProps {
  entries: PublicChangelogEntry[];
}

/**
 * K13/D31 — "Novedades", el changelog que ve quien usa la app, no quien la
 * programa. El contenido sale de `CHANGELOG-PUBLIC.md` (sus reglas de tono
 * y formato viven adentro de ese archivo) — **solo en español a
 * propósito**, no pasa por `next-intl`: traducir cada entrada a los tres
 * idiomas en cada versión es un costo de mantenimiento que no se paga para
 * este proyecto, ver la nota del archivo fuente. La UI alrededor (título,
 * estado vacío) sí es i18n como el resto de la app.
 */
export function ChangelogContent({ entries }: ChangelogContentProps) {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("changelogPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (entries.length === 0) {
    return <EmptyState message={t("changelogPage.empty")} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 16, paddingBottom: 24 }}>
      {entries.map((entry, entryIndex) =>
        entry.type === "narrative" ? (
          // Mismo tratamiento que la cita de `aboutPage` (borde izquierdo
          // fino, cursiva) — es prosa subordinada al listado de versiones,
          // no un dato de la app, y el sistema reserva ese patrón para eso.
          <div key={`${entry.heading}-${entryIndex}`} style={{ paddingLeft: 16, borderLeft: "2px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              {entry.heading}
            </div>
            {entry.paragraphs.map((p, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0", fontFamily: "var(--font-sans)", fontSize: 15, fontStyle: "italic", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                {p}
              </p>
            ))}
          </div>
        ) : (
          <div key={entry.version} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                {t("changelogPage.version", { version: entry.version })}
              </div>
              <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 2 }}>
                {entry.date}
              </div>
            </div>
            {entry.groups.map((group, i) => (
              <div key={group.heading ?? i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.heading ? <div style={GROUP_LABEL_STYLE}>{group.heading}</div> : null}
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.items.map((item) => (
                    <li key={item} className="t-body" style={{ color: "var(--text-secondary)" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
