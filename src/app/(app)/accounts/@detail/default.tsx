"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/design-system";
import { useIsDesktop, SPLIT_BREAKPOINT } from "@/hooks/use-is-desktop";

export default function AccountDetailDefault() {
  const t = useTranslations();
  const isSplit = useIsDesktop(SPLIT_BREAKPOINT);
  if (!isSplit) return null;
  return <EmptyState message={t("accountsPage.detail.selectPrompt")} />;
}
