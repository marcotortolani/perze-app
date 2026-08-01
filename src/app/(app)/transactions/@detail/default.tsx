"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/design-system";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";

/** Slot @detail sin selección — en mobile no hay columna que llenar, así que no dibuja nada. */
export default function TransactionDetailDefault() {
  const t = useTranslations();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  if (!isSplit) return null;
  return <EmptyState message={t("transactions.detail.selectPrompt")} />;
}
