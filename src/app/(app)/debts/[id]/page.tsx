"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, EmptyState, ListRow, ProgressBar, Skeleton, StatTile, usePageHeader } from "@/design-system";
import { useDebt, useDebtSchedule, useInvalidateDebt } from "@/hooks/use-debts";
import { debtsRepo } from "@/lib/repos/debts-repo";
import { formatDateShort } from "@/i18n/formatting";
import type { Locale } from "@/i18n/formatting";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { DEBT_KIND_MESSAGE_KEY } from "@/lib/reference/debt-labels";

/**
 * G5 — detalle de una deuda: cronograma de cuotas, progreso
 * pagado/pendiente. Cada cuota pendiente se puede marcar pagada a mano
 * (fuera del flujo de pago de tarjeta) — reversible con Deshacer por
 * `sonner`, mismo patrón que `useDeleteTransactionWithUndo`: se
 * ejecuta y se ofrece deshacer, nunca un diálogo de confirmación.
 */
export default function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { data: debt, isLoading: debtLoading } = useDebt(id);
  const { data: schedule, isLoading: scheduleLoading } = useDebtSchedule(id);
  const invalidateDebt = useInvalidateDebt(id);
  usePageHeader({ ...(debt ? { title: debt.name } : {}), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const toggleInstallmentPaid = async (scheduleId: string, currentlyPaid: boolean) => {
    if (currentlyPaid) {
      await debtsRepo.unmarkInstallmentPaid(scheduleId);
      invalidateDebt();
      toast(t("debtDetailPage.installmentUnmarked"));
      return;
    }
    await debtsRepo.markInstallmentPaidManually(scheduleId);
    invalidateDebt();
    toast(t("debtDetailPage.installmentMarked"), {
      duration: 5000,
      action: {
        label: t("transactions.list.undo"),
        onClick: async () => {
          await debtsRepo.unmarkInstallmentPaid(scheduleId);
          invalidateDebt();
        },
      },
    });
  };

  if (debtLoading || scheduleLoading) return <Skeleton height={300} style={{ marginTop: 16 }} />;
  if (!debt) return <EmptyState message={t("debtDetailPage.notFound")} actionLabel={t("recurringPage.back")} onAction={() => router.push("/debts")} />;

  const items = schedule ?? [];
  const paid = items.filter((i) => i.paidAt !== null);
  const pending = items.filter((i) => i.paidAt === null);
  const paidTotal = paid.reduce((s, i) => s + i.principalAmount + i.interestAmount, 0n);
  const remainingTotal = pending.reduce((s, i) => s + i.principalAmount + i.interestAmount, 0n);
  const progress = items.length > 0 ? paid.length / items.length : 0;
  const nextInstallment = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t(DEBT_KIND_MESSAGE_KEY[debt.kind])}</div>
          <Amount value={money(remainingTotal, debt.currencyCode)} size="hero" fit showSign={false} polarity="neutral" tabular style={{ marginTop: 6 }} />
          <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 4 }}>{t("debtDetailPage.remaining")}</div>
        </div>

        {items.length > 0 ? (
          <div>
            <ProgressBar value={progress} height={8} />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              {t("debtDetailPage.installmentsProgress", { paid: paid.length, total: items.length })}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 16 }}>
          <StatTile label={t("debtDetailPage.paidSoFar")} value={formatAmountCompact(money(paidTotal, debt.currencyCode), { showSign: false })} style={{ flex: 1 }} />
          {nextInstallment ? (
            <StatTile label={t("debtDetailPage.nextDue")} value={formatDateShort(locale, new Date(nextInstallment.dueDate))} style={{ flex: 1 }} />
          ) : null}
        </div>

        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("debtDetailPage.schedule")}</div>
          {items.length === 0 ? (
            <p className="t-body" style={{ color: "var(--text-muted)", marginTop: 8 }}>{t("debtDetailPage.noSchedule")}</p>
          ) : (
            [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((item) => {
              const isPaid = item.paidAt !== null;
              return (
                <ListRow
                  key={item.id}
                  label={t("debtDetailPage.installmentNumber", { number: item.number, total: debt.installmentCount ?? items.length })}
                  meta={isPaid ? t("debtDetailPage.installmentPaidOn", { date: formatDateShort(locale, new Date(item.paidAt!)) }) : formatDateShort(locale, new Date(item.dueDate))}
                  variant="value"
                  icon={isPaid ? "check" : undefined}
                  iconBackground={isPaid ? "var(--good)" : undefined}
                  value={<Amount value={money(item.principalAmount + item.interestAmount, debt.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />}
                  onClick={() => toggleInstallmentPaid(item.id, isPaid)}
                />
              );
            })
          )}
        </div>

        <Button variant="secondary" fullWidth={false} onClick={() => router.push(`/debts/${debt.id}/edit`)}>
          {t("debtDetailPage.editDebt")}
        </Button>
      </div>
    </div>
  );
}
