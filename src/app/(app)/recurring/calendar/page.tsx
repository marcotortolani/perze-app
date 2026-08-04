"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePageHeader } from "@/design-system";
import { RecurringMonthCalendar } from "../RecurringMonthCalendar";

/** G1 — vencimientos del mes en calendario, ruta de mobile (en desktop va embebido en `/recurring`). */
export default function RecurringCalendarPage() {
  const t = useTranslations();
  const router = useRouter();
  usePageHeader({ title: t("recurringCalendarPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RecurringMonthCalendar />
    </div>
  );
}
