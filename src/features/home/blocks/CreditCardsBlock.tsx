"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AccountRow } from "@/design-system";
import { money } from "@/lib/money/money";
import { accountColorVar } from "@/lib/reference/account-colors";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useHomeData } from "../home-data";

export function CreditCardsBlock() {
  const t = useTranslations();
  const router = useRouter();
  const { creditCardAccounts } = useHomeData();
  const privacy = usePrivacyStore((s) => s.privacyMode);

  if (creditCardAccounts.length === 0) return null;

  return (
    <section>
      <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("home.creditCards")}</div>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {creditCardAccounts.map((a) => (
          <AccountRow
            key={a.id}
            name={a.name}
            meta={t("home.creditCardCycleMeta")}
            balance={money(-a.currentBalance, a.currencyCode)}
            icon="credit-card"
            iconBackground={accountColorVar(a.color)}
            privacy={privacy}
            onClick={() => router.push(`/accounts?account=${a.id}`, { scroll: false })}
          />
        ))}
      </div>
    </section>
  );
}
