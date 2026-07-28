"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Chip, Icon, Input, Keypad, OptionCard, SegmentedControl, Switch } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import type { IconName } from "@/design-system/core/Icon";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { COUNTRIES, CURRENCIES, COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { todayIso } from "@/lib/repos/ids";
import type { AccountKind, AccountRow, Visibility } from "@/lib/db/schema";

const KIND_ICON: Record<AccountKind, IconName> = {
  cash: "banknote",
  checking: "bank",
  savings: "piggy-bank",
  credit_card: "credit-card",
  wallet: "wallet",
  broker: "trend",
  loan: "handshake",
  receivable: "receipt",
  other: "more",
};

export interface AccountFormFlowProps {
  householdId: string;
  userId: string;
  existing?: AccountRow | undefined;
  onClose: () => void;
  onSaved: (account: AccountRow) => void;
}

/** E3 — crear/editar cuenta. Bloque E, Fase 8. */
export function AccountFormFlow({ householdId, userId, existing, onClose, onSaved }: AccountFormFlowProps) {
  const t = useTranslations();
  const KIND_OPTIONS: Array<{ id: AccountKind; label: string; description: string; icon: IconName }> = [
    { id: "cash", label: t(ACCOUNT_KIND_MESSAGE_KEY.cash), description: t("accounts.form.kindDescription.cash"), icon: KIND_ICON.cash },
    { id: "checking", label: t(ACCOUNT_KIND_MESSAGE_KEY.checking), description: t("accounts.form.kindDescription.checking"), icon: KIND_ICON.checking },
    { id: "savings", label: t(ACCOUNT_KIND_MESSAGE_KEY.savings), description: t("accounts.form.kindDescription.savings"), icon: KIND_ICON.savings },
    { id: "credit_card", label: t(ACCOUNT_KIND_MESSAGE_KEY.credit_card), description: t("accounts.form.kindDescription.credit_card"), icon: KIND_ICON.credit_card },
    { id: "wallet", label: t(ACCOUNT_KIND_MESSAGE_KEY.wallet), description: t("accounts.form.kindDescription.wallet"), icon: KIND_ICON.wallet },
    { id: "broker", label: t(ACCOUNT_KIND_MESSAGE_KEY.broker), description: t("accounts.form.kindDescription.broker"), icon: KIND_ICON.broker },
    { id: "loan", label: t("accounts.form.kindLabel.loan"), description: t("accounts.form.kindDescription.loan"), icon: KIND_ICON.loan },
    { id: "receivable", label: t("accounts.form.kindLabel.receivable"), description: t("accounts.form.kindDescription.receivable"), icon: KIND_ICON.receivable },
    { id: "other", label: t("accounts.form.kindLabel.other"), description: t("accounts.form.kindDescription.other"), icon: KIND_ICON.other },
  ];
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? "cash");
  const [name, setName] = useState(existing?.name ?? "");
  const [countryCode, setCountryCode] = useState(existing?.countryCode ?? "UY");
  const [currencyCode, setCurrencyCode] = useState(existing?.currencyCode ?? COUNTRIES.find((c) => c.code === "UY")!.defaultCurrency);
  const [openingExpr, setOpeningExpr] = useState("");
  const [includeInNetWorth, setIncludeInNetWorth] = useState(existing?.includeInNetWorth ?? true);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? "household");
  const [statementDay, setStatementDay] = useState(existing?.statementDay?.toString() ?? "");
  const [dueDay, setDueDay] = useState(existing?.dueDay?.toString() ?? "");
  const [interestRate, setInterestRate] = useState(existing?.interestRate ?? "");
  const [termMonths, setTermMonths] = useState(existing?.termMonths?.toString() ?? "");
  const [step, setStep] = useState<"kind" | "details">(existing ? "details" : "kind");
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && (kind !== "credit_card" || (statementDay && dueDay)) && (kind !== "loan" || (interestRate && termMonths));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const openingBalance = existing ? existing.openingBalance : evaluateKeypadExpression(openingExpr || "0", currencyCode).amount;
      const patch = {
        name: name.trim(),
        kind,
        countryCode,
        currencyCode,
        creditLimit: null,
        statementDay: kind === "credit_card" ? Number(statementDay) : null,
        dueDay: kind === "credit_card" ? Number(dueDay) : null,
        interestRate: kind === "loan" ? interestRate : null,
        termMonths: kind === "loan" ? Number(termMonths) : null,
        includeInNetWorth,
        visibility,
      };

      let saved: AccountRow;
      if (existing) {
        await accountsRepo.update(existing.id, patch);
        saved = { ...existing, ...patch };
      } else {
        saved = await accountsRepo.create({
          householdId,
          ownerId: userId,
          institutionId: null,
          openingBalance,
          openingDate: todayIso(),
          color: null,
          icon: null,
          archivedAt: null,
          createdBy: userId,
          ...patch,
        });
      }
      toast(existing ? t("accounts.form.updated") : t("accounts.form.created"));
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => (step === "details" && !existing ? setStep("kind") : onClose())}
          aria-label={step === "details" && !existing ? t("accounts.form.back") : t("accounts.form.close")}
          style={{ background: "none", border: 0, cursor: "pointer", padding: 8, margin: -8 }}
        >
          <Icon name={step === "details" && !existing ? "chevron-left" : "close"} size={22} color="var(--text-secondary)" />
        </button>
        <span className="t-label" style={{ color: "var(--text-secondary)" }}>
          {existing ? t("accounts.form.editTitle") : t("accounts.form.newTitle")}
        </span>
      </div>

      {step === "kind" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          {KIND_OPTIONS.map((k) => (
            <OptionCard key={k.id} title={k.label} description={k.description} icon={k.icon} selected={kind === k.id} onClick={() => { setKind(k.id); setStep("details"); }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", paddingBottom: 24 }}>
          <button type="button" onClick={() => setStep("kind")} style={{ alignSelf: "flex-start", background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={KIND_OPTIONS.find((k) => k.id === kind)!.icon} size={20} color="var(--text-secondary)" />
            <span style={{ fontSize: 14, color: "var(--primary-ink)" }}>{KIND_OPTIONS.find((k) => k.id === kind)!.label} · {t("accounts.form.change")}</span>
          </button>

          <Input label={t("accounts.form.name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("accounts.form.namePlaceholder")} />

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.country")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COUNTRIES.map((c) => (
                <Chip
                  key={c.code}
                  selected={countryCode === c.code}
                  onClick={() => { setCountryCode(c.code); setCurrencyCode(c.defaultCurrency); }}
                >
                  {c.flag} {t(COUNTRY_MESSAGE_KEY[c.code as keyof typeof COUNTRY_MESSAGE_KEY])}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.currency")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CURRENCIES.map((c) => (
                <Chip key={c.code} selected={currencyCode === c.code} onClick={() => setCurrencyCode(c.code)}>
                  {c.code}
                </Chip>
              ))}
            </div>
          </div>

          {!existing ? (
            <div>
              <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.openingBalance")}</p>
              <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28, marginBottom: 8 }}>
                {currencyCode} {openingExpr || "0"}
              </div>
              <Keypad onKey={(k) => setOpeningExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + k))} onClear={() => setOpeningExpr("")} />
            </div>
          ) : null}

          {kind === "credit_card" ? (
            <div style={{ display: "flex", gap: 12 }}>
              <Input label={t("accounts.form.statementDay")} value={statementDay} onChange={(e) => setStatementDay(e.target.value.replace(/\D/g, ""))} placeholder={t("accounts.form.dayPlaceholder")} />
              <Input label={t("accounts.form.dueDay")} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} placeholder={t("accounts.form.dayPlaceholder")} />
            </div>
          ) : null}

          {kind === "loan" ? (
            <div style={{ display: "flex", gap: 12 }}>
              <Input label={t("accounts.form.interestRate")} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder={t("accounts.form.interestRatePlaceholder")} />
              <Input label={t("accounts.form.termMonths")} value={termMonths} onChange={(e) => setTermMonths(e.target.value.replace(/\D/g, ""))} placeholder={t("accounts.form.termMonthsPlaceholder")} />
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{t("accounts.form.includeInNetWorth")}</span>
            <Switch checked={includeInNetWorth} onChange={setIncludeInNetWorth} id="net-worth-switch" />
          </div>

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.visibility")}</p>
            <SegmentedControl options={[{ id: "private", label: t("accounts.form.private") }, { id: "household", label: t("accounts.form.shared") }]} value={visibility} onChange={(v) => setVisibility(v as Visibility)} />
          </div>

          <div style={{ marginTop: "auto" }}>
            <Button disabled={!canSave || saving} onClick={handleSave}>
              {existing ? t("accounts.form.saveChanges") : t("accounts.form.createAccount")}
            </Button>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}
