"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, Chip, Icon, IconButton, Input, Keypad, ListRow, OptionCard, SegmentedControl, Sheet, Switch } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import type { IconName } from "@/design-system/core/Icon";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { decimalsFor } from "@/lib/money/decimals";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { accountGroupsRepo } from "@/lib/repos/account-groups-repo";
import { currenciesRepo } from "@/lib/repos/currencies-repo";
import { useAccountGroups, useInvalidateAccountGroups } from "@/hooks/use-account-groups";
import { useAccounts } from "@/hooks/use-accounts";
import { useCurrencies, useInvalidateCurrencies } from "@/hooks/use-currencies";
import { COUNTRIES, COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { ACCOUNT_COLOR_KEYS, accountColorVar, type AccountColorKey } from "@/lib/reference/account-colors";
import { todayIso } from "@/lib/repos/ids";
import type { AccountKind, AccountRow, Visibility } from "@/lib/db/schema";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

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

/**
 * Inverso de `evaluateKeypadExpression`: un monto guardado, como el string
 * crudo que el `<Keypad>` produciría si el usuario lo hubiera tipeado — sin
 * separador de miles (el keypad nunca lo muestra mientras se tipea) y sin
 * parte decimal si es cero, para no forzar ",00" en un monto entero. Así
 * el campo arranca en edición mostrando el valor real y editable en el
 * lugar, en vez de una vista previa aparte que se borra entera al tocar
 * la primera tecla.
 */
function moneyToKeypadExpr(amount: bigint, currency: string, decimalSeparator: string): string {
  const decimals = decimalsFor(currency);
  const divisor = 10n ** BigInt(decimals);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const intPart = abs / divisor;
  const fracPart = abs % divisor;
  const fracStr = decimals > 0 && fracPart > 0n ? `${decimalSeparator}${fracPart.toString().padStart(decimals, "0")}` : "";
  return `${negative ? "-" : ""}${intPart}${fracStr}`;
}

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
  const locale = useLocale() as Locale;
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
  const [color, setColor] = useState<AccountColorKey | null>(
    existing?.color && (ACCOUNT_COLOR_KEYS as readonly string[]).includes(existing.color) ? (existing.color as AccountColorKey) : null
  );
  const { data: currencies = [] } = useCurrencies();
  const invalidateCurrencies = useInvalidateCurrencies();
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState("");
  const [newCurrencyName, setNewCurrencyName] = useState("");
  const [newCurrencyKind, setNewCurrencyKind] = useState<"fiat" | "crypto">("crypto");
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [openingExpr, setOpeningExpr] = useState(() =>
    existing ? moneyToKeypadExpr(existing.openingBalance, currencyCode, decimalSeparatorForLocale(locale)) : ""
  );
  const [includeInNetWorth, setIncludeInNetWorth] = useState(existing?.includeInNetWorth ?? true);
  // "custom" se define en J4 (permisos), no en este formulario — si la
  // cuenta ya es custom, el toggle simple de acá no la puede representar;
  // arranca en "household" y J4 sigue siendo la única forma de volver a "custom".
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility === "private" ? "private" : "household");
  const [statementDay, setStatementDay] = useState(existing?.statementDay?.toString() ?? "");
  const [dueDay, setDueDay] = useState(existing?.dueDay?.toString() ?? "");
  const [creditLimitExpr, setCreditLimitExpr] = useState(() =>
    existing?.creditLimit != null ? moneyToKeypadExpr(existing.creditLimit, currencyCode, decimalSeparatorForLocale(locale)) : ""
  );
  const [interestRate, setInterestRate] = useState(existing?.interestRate ?? "");
  const [termMonths, setTermMonths] = useState(existing?.termMonths?.toString() ?? "");
  const [step, setStep] = useState<"kind" | "details">(existing ? "details" : "kind");
  const [saving, setSaving] = useState(false);

  // Tanda 4 — tarjeta multi-moneda: `joinGroupId` es el grupo existente al
  // que esta cuenta se suma (límite/ciclo dejan de ser suyos, pasan a
  // leerse del grupo). `createNewGroup` es la otra punta: recién nace
  // agrupable, para que una SEGUNDA moneda pueda sumarse después — el
  // grupo se crea acá mismo, con los mismos datos que se están cargando.
  const { data: allGroups = [] } = useAccountGroups(householdId);
  const invalidateGroups = useInvalidateAccountGroups(householdId);
  const { data: allAccounts = [] } = useAccounts(householdId);
  // El nombre de un grupo se copia del nombre de la cuenta que lo creó y
  // nunca se vuelve a sincronizar — dos tarjetas "Visa BBVA" (una por
  // moneda) fácilmente terminan con dos grupos que se llaman igual. Sin
  // más dato que el nombre son indistinguibles en el selector, así que acá
  // se suma la moneda de cada miembro vivo como desambiguador.
  const groupMemberCurrencies = (groupId: string, excludeAccountId?: string) =>
    allAccounts.filter((a) => a.accountGroupId === groupId && a.archivedAt === null && a.id !== excludeAccountId).map((a) => a.currencyCode);
  const creditCardGroups = allGroups.filter((g) => g.kind === "credit_card" && g.archivedAt === null);
  const [joinGroupId, setJoinGroupId] = useState<string | null>(existing?.accountGroupId ?? null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [createNewGroup, setCreateNewGroup] = useState(false);
  const joinedGroup = joinGroupId ? (creditCardGroups.find((g) => g.id === joinGroupId) ?? null) : null;
  // Un grupo solo aparece como destino a UNIRSE si tiene otro miembro vivo
  // que no sea esta cuenta — el propio (re-seleccionarlo es un no-op
  // confuso) y los huérfanos (0 miembros, restos de un intento anterior
  // que nunca se completó) quedan afuera.
  const joinableGroups = creditCardGroups.filter((g) => g.id !== joinGroupId && groupMemberCurrencies(g.id, existing?.id).length > 0);

  const canSave =
    name.trim().length > 0 &&
    (kind !== "credit_card" || !!joinGroupId || (statementDay && dueDay)) &&
    (kind !== "loan" || (interestRate && termMonths));
  const newCurrencyCodeNormalized = newCurrencyCode.trim().toUpperCase();
  const canAddCurrency = /^[A-Z0-9]{2,10}$/.test(newCurrencyCodeNormalized) && newCurrencyName.trim().length > 0;

  const handleAddCurrency = async () => {
    if (!canAddCurrency || addingCurrency) return;
    setAddingCurrency(true);
    try {
      const created = await currenciesRepo.add({
        code: newCurrencyCodeNormalized,
        name: newCurrencyName.trim(),
        symbol: newCurrencyCodeNormalized,
        decimals: newCurrencyKind === "crypto" ? 8 : 2,
        kind: newCurrencyKind,
      });
      invalidateCurrencies();
      setCurrencyCode(created.code);
      setAddCurrencyOpen(false);
      setNewCurrencyCode("");
      setNewCurrencyName("");
    } catch {
      toast(t("accounts.form.addCurrencyError"));
    } finally {
      setAddingCurrency(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      // Editable también en edición (no solo al crear): corrige el punto
      // de partida en sí, sin dejar un ajuste de conciliación — lo que la
      // cuenta tenía en `openingDate` cambia, los movimientos posteriores
      // no se tocan. El campo arranca sembrado con el valor actual (ver
      // `moneyToKeypadExpr`), así que vacío acá es una limpieza deliberada
      // (igual que al crear: sin dígitos, el monto es 0), no "no tocado".
      const openingBalance = evaluateKeypadExpression(openingExpr || "0", currencyCode, numberLocaleForUiLocale(locale)).amount;
      const creditLimit =
        kind === "credit_card" && creditLimitExpr.trim() !== ""
          ? evaluateKeypadExpression(creditLimitExpr, currencyCode, numberLocaleForUiLocale(locale)).amount
          : null;

      // Tanda 4 — si esta tarjeta se suma a un grupo (existente o recién
      // creado), el límite y el ciclo pasan a vivir en el GRUPO, nunca en
      // la cuenta — es el mismo plástico, el mismo corte, así que las dos
      // cosas a la vez sería la fuente de verdad duplicada que la
      // migración de tarjetas multi-moneda existe para evitar.
      let accountGroupId: string | null = kind === "credit_card" ? joinGroupId : null;
      if (kind === "credit_card" && !joinGroupId && createNewGroup) {
        const group = await accountGroupsRepo.create({
          householdId,
          kind: "credit_card",
          name: name.trim(),
          creditLimit,
          limitCurrency: currencyCode,
          statementDay: Number(statementDay),
          dueDay: Number(dueDay),
          archivedAt: null,
          createdBy: userId,
        });
        invalidateGroups();
        accountGroupId = group.id;
      }
      const isGrouped = kind === "credit_card" && !!accountGroupId;

      const patch = {
        name: name.trim(),
        kind,
        countryCode,
        currencyCode,
        color,
        creditLimit: kind === "credit_card" && !isGrouped ? creditLimit : null,
        statementDay: kind === "credit_card" && !isGrouped ? Number(statementDay) : null,
        dueDay: kind === "credit_card" && !isGrouped ? Number(dueDay) : null,
        accountGroupId,
        interestRate: kind === "loan" ? interestRate : null,
        termMonths: kind === "loan" ? Number(termMonths) : null,
        includeInNetWorth,
        visibility,
      };

      // Si esta cuenta deja un grupo (o se une a otro), y era su último
      // miembro vivo, el grupo abandonado queda huérfano — sin esto es
      // exactamente el bug que generó dos "Visa BBVA" indistinguibles en
      // el selector. Se archiva, nunca se borra (mismo criterio que
      // `accounts`: apagar oculta, no destruye).
      const previousGroupId = existing?.accountGroupId ?? null;
      if (previousGroupId && previousGroupId !== accountGroupId) {
        const stillHasMembers = groupMemberCurrencies(previousGroupId, existing?.id).length > 0;
        if (!stillHasMembers) {
          await accountGroupsRepo.archive(previousGroupId);
          invalidateGroups();
        }
      }

      let saved: AccountRow;
      if (existing) {
        // El trigger `accounts_recompute_balance` (servidor) recalcula
        // `current_balance` cuando cambia `opening_balance`, pero eso
        // llega recién en el próximo pull — sin este ajuste optimista acá,
        // el saldo se ve viejo en este mismo dispositivo hasta que
        // sincronice. Sumar el delta es exactamente lo que el trigger
        // termina calculando: `current_balance` no depende de nada más que
        // `opening_balance` y la suma de movimientos, que no cambió.
        const openingBalanceDelta = openingBalance - existing.openingBalance;
        const updatePatch = { ...patch, openingBalance, currentBalance: existing.currentBalance + openingBalanceDelta };
        await accountsRepo.update(existing.id, updatePatch);
        saved = { ...existing, ...updatePatch };
      } else {
        saved = await accountsRepo.create({
          householdId,
          ownerId: userId,
          institutionId: null,
          openingBalance,
          openingDate: todayIso(),
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
        <IconButton
          icon={step === "details" && !existing ? "chevron-left" : "close"}
          ariaLabel={step === "details" && !existing ? t("accounts.form.back") : t("accounts.form.close")}
          onClick={() => (step === "details" && !existing ? setStep("kind") : onClose())}
          style={{ margin: -11 }}
        />
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
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: color ? accountColorVar(color) : "var(--surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={KIND_OPTIONS.find((k) => k.id === kind)!.icon} size={17} color={color ? "#ffffff" : "var(--text-secondary)"} />
            </span>
            <span style={{ fontSize: 14, color: "var(--primary-ink)" }}>{KIND_OPTIONS.find((k) => k.id === kind)!.label} · {t("accounts.form.change")}</span>
          </button>

          <Input label={t("accounts.form.name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("accounts.form.namePlaceholder")} />

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.color")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
              <button
                type="button"
                onClick={() => setColor(null)}
                aria-label={t("accounts.form.colorNone")}
                aria-pressed={color === null}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "var(--surface-2)",
                  border: `2px solid ${color === null ? "var(--selection-ring)" : "transparent"}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="close" size={16} color="var(--text-muted)" />
              </button>
              {ACCOUNT_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  aria-label={t(`accounts.form.colors.${key}`)}
                  aria-pressed={color === key}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: accountColorVar(key),
                    border: `2px solid ${color === key ? "var(--text-primary)" : "transparent"}`,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.country")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COUNTRIES.map((c) => (
                <Chip
                  key={c.code}
                  selected={countryCode === c.code}
                  onClick={() => { setCountryCode(c.code); setCurrencyCode(c.defaultCurrency); }}
                >
                  {t(COUNTRY_MESSAGE_KEY[c.code as keyof typeof COUNTRY_MESSAGE_KEY])}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.currency")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {currencies.map((c) => (
                <Chip key={c.code} selected={currencyCode === c.code} onClick={() => setCurrencyCode(c.code)}>
                  {c.code}
                </Chip>
              ))}
              <Chip selected={false} onClick={() => setAddCurrencyOpen(true)}>
                + {t("accounts.form.addCurrency")}
              </Chip>
            </div>
          </div>

          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.openingBalance")}</p>
            <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28, marginBottom: 8 }}>
              {currencyCode} {openingExpr || "0"}
            </div>
            <Keypad onKey={(k) => setOpeningExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + k))} onClear={() => setOpeningExpr("")} />
            {existing ? (
              // No es una conciliación: no queda ningún ajuste registrado,
              // se corrige el punto de partida en sí — los movimientos
              // posteriores no se tocan, solo el número del que arrancan.
              <p className="t-caption" style={{ color: "var(--text-muted)", marginTop: 8 }}>{t("accounts.form.openingBalanceEditHint")}</p>
            ) : null}
          </div>

          {kind === "credit_card" ? (
            <>
              {/* Tanda 4 — solo aparece si hay otro grupo real (con algún
                  miembro vivo) al que unirse, o si esta cuenta ya está
                  agrupada: la mayoría de las tarjetas nunca lo va a ver,
                  cero pasos extra a menos que haga falta. */}
              {joinableGroups.length > 0 || joinedGroup ? (
                <button
                  type="button"
                  onClick={() => setGroupPickerOpen(true)}
                  style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}
                >
                  <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("accounts.form.cardGroup")}</div>
                  <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>
                    {joinedGroup
                      ? `${joinedGroup.name} · ${[currencyCode, ...groupMemberCurrencies(joinedGroup.id, existing?.id)].join(", ")}`
                      : t("accounts.form.cardGroupNone")}
                  </div>
                </button>
              ) : null}

              {joinedGroup ? (
                // Límite y ciclo ya no son de esta cuenta — son del grupo.
                <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0 }}>{t("accounts.form.cardGroupInherits", { name: joinedGroup.name })}</p>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Input label={t("accounts.form.statementDay")} value={statementDay} onChange={(e) => setStatementDay(e.target.value.replace(/\D/g, ""))} placeholder={t("accounts.form.dayPlaceholder")} />
                    <Input label={t("accounts.form.dueDay")} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} placeholder={t("accounts.form.dayPlaceholder")} />
                  </div>
                  <div>
                    <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.creditLimit")}</p>
                    <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 24, marginBottom: 8 }}>
                      {currencyCode} {creditLimitExpr || "0"}
                    </div>
                    <Keypad onKey={(k) => setCreditLimitExpr((s) => (k === "backspace" ? s.slice(0, -1) : s + k))} onClear={() => setCreditLimitExpr("")} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{t("accounts.form.multiCurrencyCard")}</span>
                    <Switch checked={createNewGroup} onChange={setCreateNewGroup} id="card-group-switch" />
                  </div>
                  {createNewGroup ? (
                    <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0 }}>{t("accounts.form.multiCurrencyCardHint")}</p>
                  ) : null}
                </>
              )}
            </>
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
      <Sheet open={addCurrencyOpen} title={t("accounts.form.addCurrency")} onClose={() => setAddCurrencyOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>{t("accounts.form.addCurrencyHint")}</p>
          <Input
            label={t("accounts.form.addCurrencyCode")}
            value={newCurrencyCode}
            onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
            placeholder="BTC, USDT, GBP…"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <Input label={t("accounts.form.addCurrencyName")} value={newCurrencyName} onChange={(e) => setNewCurrencyName(e.target.value)} placeholder={t("accounts.form.addCurrencyNamePlaceholder")} />
          <div>
            <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t("accounts.form.addCurrencyKind")}</p>
            <SegmentedControl
              options={[
                { id: "crypto", label: t("accounts.form.addCurrencyCrypto") },
                { id: "fiat", label: t("accounts.form.addCurrencyFiat") },
              ]}
              value={newCurrencyKind}
              onChange={(v) => setNewCurrencyKind(v as "fiat" | "crypto")}
            />
          </div>
          <Button disabled={!canAddCurrency || addingCurrency} onClick={handleAddCurrency}>
            {t("accounts.form.addCurrencyConfirm")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={groupPickerOpen} title={t("accounts.form.cardGroup")} onClose={() => setGroupPickerOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ListRow
            label={t("accounts.form.cardGroupNone")}
            onClick={() => {
              // Al abandonar el grupo, límite/ciclo dejan de heredarse — se
              // precargan con lo que el grupo tenía para no perderlos (la
              // cuenta nunca los tuvo propios mientras estaba agrupada).
              if (joinedGroup) {
                setStatementDay(joinedGroup.statementDay?.toString() ?? "");
                setDueDay(joinedGroup.dueDay?.toString() ?? "");
                setCreditLimitExpr(
                  joinedGroup.creditLimit != null ? moneyToKeypadExpr(joinedGroup.creditLimit, currencyCode, decimalSeparatorForLocale(locale)) : ""
                );
              }
              setJoinGroupId(null);
              setGroupPickerOpen(false);
            }}
          />
          {joinableGroups.map((g) => (
            <ListRow
              key={g.id}
              label={g.name}
              meta={groupMemberCurrencies(g.id, existing?.id).join(", ")}
              onClick={() => {
                setJoinGroupId(g.id);
                setCreateNewGroup(false);
                setGroupPickerOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </ScreenShell>
  );
}
