"use client";

import { useTranslations } from "next-intl";
import { AccountCarousel, DateStrip, Input, Sheet, Switch } from "@/design-system";
import type { AccountRow } from "@/lib/db/schema";
import type { CaptureDraft } from "@/stores/capture-draft-store";

export interface DetailsSheetProps {
  open: boolean;
  onClose: () => void;
  draft: CaptureDraft;
  accounts: AccountRow[];
  onSetField: <K extends keyof CaptureDraft>(key: K, value: CaptureDraft[K]) => void;
}

function isoDaysAround(centerIso: string, span = 3): string[] {
  const center = new Date(centerIso);
  return Array.from({ length: span * 2 + 1 }, (_, i) => {
    const d = new Date(center);
    d.setDate(d.getDate() - span + i);
    return d.toISOString().slice(0, 10);
  });
}

function dayLabel(iso: string, todayIso: string, labels: { today: string; yesterday: string }): string | undefined {
  if (iso === todayIso) return labels.today;
  const yesterday = new Date(todayIso);
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return labels.yesterday;
  return undefined;
}

/** C3 — detalles colapsados: cuenta, fecha, comercio, nota. Todo con default, ninguna fila obligatoria. */
export function DetailsSheet({ open, onClose, draft, accounts, onSetField }: DetailsSheetProps) {
  const t = useTranslations();
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateValue = draft.occurredAt.slice(0, 10);
  const dayLabels = { today: t("capture.details_sheet.today"), yesterday: t("capture.details_sheet.yesterday") };
  const days = isoDaysAround(todayIso).map((date) => ({ date, label: dayLabel(date, todayIso, dayLabels) }));

  return (
    <Sheet open={open} title={t("capture.details_sheet.title")} onClose={onClose} height={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", maxHeight: 380 }}>
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("capture.details_sheet.account")}
          </p>
          <AccountCarousel
            accounts={accounts.map((a) => ({ id: a.id, institution: a.name, name: a.kind, balance: { amount: a.currentBalance, currency: a.currencyCode }, country: a.countryCode ?? undefined }))}
            activeId={draft.accountId ?? undefined}
            onSelect={(id) => onSetField("accountId", id)}
          />
        </div>
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("capture.details_sheet.date")}
          </p>
          <DateStrip days={days} value={dateValue} onChange={(date) => onSetField("occurredAt", `${date}T12:00:00.000Z`)} />
        </div>
        <Input label={t("capture.details_sheet.payee")} value={draft.payeeName} onChange={(e) => onSetField("payeeName", e.target.value)} placeholder={t("capture.details_sheet.payeePlaceholder")} />
        <Input label={t("capture.details_sheet.note")} value={draft.note} onChange={(e) => onSetField("note", e.target.value)} multiline placeholder={t("capture.details_sheet.notePlaceholder")} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{t("capture.details_sheet.burstMode")}</span>
          <Switch checked={draft.burstMode} onChange={(checked) => onSetField("burstMode", checked)} id="burst-switch" />
        </div>
      </div>
    </Sheet>
  );
}
