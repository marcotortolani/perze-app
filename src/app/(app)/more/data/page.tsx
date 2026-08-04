"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, ListRow, usePageHeader } from "@/design-system";

/**
 * Hub "Datos y backup" — antes dos filas sueltas en el índice de Más
 * (Exportar backup / Importar CSV), reagrupadas acá por decisión de
 * producto. `/more/export` (K10) y `/more/import` (K9) no cambian: siguen
 * siendo las mismas pantallas, solo se llega a ellas desde acá.
 */
export default function DataAndBackupPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("morePage.dataAndBackup"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12 }}>
        <Card padding="4px 16px">
          <ListRow icon="install" label={t("exportPage.headerTitle")} meta={t("dataPage.exportMeta")} onClick={() => router.push("/more/export")} />
          <ListRow icon="install" label={t("importCsvPage.title")} meta={t("dataPage.importMeta")} onClick={() => router.push("/more/import")} />
        </Card>
      </div>
    </div>
  );
}
