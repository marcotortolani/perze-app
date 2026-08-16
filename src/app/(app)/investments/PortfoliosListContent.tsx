"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Input, ListRow, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useInvalidatePortfolios, usePortfolios } from "@/hooks/use-investments";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { portfoliosRepo } from "@/lib/repos/portfolios-repo";

/**
 * I1/I2 (raíz nueva) — lista de portfolios, mismo rol que `/accounts` para
 * cuentas: antes `/investments` mostraba directo el overview del PRIMER
 * portfolio (`portfolios?.[0]`), sin forma de ver ni crear un segundo,
 * aunque el schema y el repo ya lo soportaban. Ahora esta pantalla es la
 * raíz del bloque I, y cada portfolio vive en `/investments/[portfolioId]`
 * (mismo patrón de ruta que ya usan `trades/new`/`instruments/new`).
 */
export default function PortfoliosListContent() {
  const t = useTranslations();
  usePageHeader({ title: t("nav.investments") });
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const portfoliosQuery = usePortfolios(household?.id);
  const { data: portfolios } = portfoliosQuery;
  const invalidatePortfolios = useInvalidatePortfolios(household?.id);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const errorState = useQueryErrorState(portfoliosQuery, { what: t("investmentsPage.loadError") });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !portfolios || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const portfolio = await portfoliosRepo.create({ householdId: household.id, name: newName.trim(), baseCurrency: household.baseCurrency, brokerAccountId: null, createdBy: userId });
      invalidatePortfolios();
      setCreating(false);
      setNewName("");
      router.push(`/investments/${portfolio.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (portfolios.length === 0) {
    return (
      <EmptyState
        message={t("investmentsPage.noPortfolio")}
        actionLabel={t("investmentsPage.createPortfolio")}
        onAction={async () => {
          const portfolio = await portfoliosRepo.create({ householdId: household.id, name: t("investmentsPage.defaultPortfolioName"), baseCurrency: household.baseCurrency, brokerAccountId: null, createdBy: userId });
          invalidatePortfolios();
          router.push(`/investments/${portfolio.id}`);
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, paddingBottom: 24 }}>
      <ListRow icon="plus" label={t("investmentsPage.createPortfolio")} variant="action" onClick={() => setCreating(true)} />
      {portfolios.map((portfolio) => (
        <ListRow key={portfolio.id} icon="invest" label={portfolio.name} meta={portfolio.baseCurrency} variant="navigation" onClick={() => router.push(`/investments/${portfolio.id}`)} />
      ))}

      <Sheet open={creating} title={t("investmentsPage.createPortfolio")} onClose={() => setCreating(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t("investmentsPage.portfolioName")} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("investmentsPage.defaultPortfolioName")} autoFocus />
          <Button disabled={!newName.trim() || saving} onClick={handleCreate}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
