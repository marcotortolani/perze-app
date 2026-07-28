"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, InstitutionTile, Input, ProgressSteps } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type { AccountKind } from "@/lib/db/schema";

interface Preset {
  name: string;
  kind: AccountKind;
}

const PRESETS_BY_COUNTRY: Record<string, Preset[]> = {
  UY: [
    { name: "Itaú", kind: "savings" },
    { name: "Brou", kind: "checking" },
    { name: "Santander", kind: "checking" },
    { name: "Mercado Pago", kind: "wallet" },
    { name: "Prex", kind: "wallet" },
  ],
  AR: [
    { name: "Banco Nación", kind: "checking" },
    { name: "Mercado Pago", kind: "wallet" },
    { name: "Ualá", kind: "wallet" },
    { name: "Banco Galicia", kind: "checking" },
  ],
  BR: [
    { name: "Nubank", kind: "checking" },
    { name: "Itaú", kind: "checking" },
    { name: "PicPay", kind: "wallet" },
  ],
  US: [
    { name: "Chase", kind: "checking" },
    { name: "Bank of America", kind: "checking" },
    { name: "PayPal", kind: "wallet" },
  ],
  MX: [
    { name: "BBVA", kind: "checking" },
    { name: "Mercado Pago", kind: "wallet" },
  ],
  CL: [
    { name: "Banco de Chile", kind: "checking" },
    { name: "Mercado Pago", kind: "wallet" },
  ],
};

// "Efectivo" y "Otro" quedan sin traducir a propósito: `accountPreset` los
// guarda como string y `onboarding/success/page.tsx` los vuelve a comparar
// literal contra "Efectivo" para inferir el `AccountKind` — cambiar el
// texto acá rompería esa inferencia. Traducir esto bien requiere separar
// identidad (`kind`) de label en el store, fuera del alcance de i18n.
const ALWAYS: Preset[] = [{ name: "Efectivo", kind: "cash" }, { name: "Otro", kind: "other" }];

/** A6 — primera cuenta: presets visuales por país, máximo 6 visibles + buscar. */
export default function OnboardingAccountPage() {
  const router = useRouter();
  const t = useTranslations();
  const setField = useOnboardingStore((s) => s.setField);
  const countryCode = useOnboardingStore((s) => s.draft.countryCode);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Preset | null>(null);

  const presets = useMemo(() => {
    const local = PRESETS_BY_COUNTRY[countryCode] ?? [];
    const all = [...local, ...ALWAYS];
    if (!query.trim()) return all.slice(0, 6);
    const needle = query.trim().toLowerCase();
    return all.filter((p) => p.name.toLowerCase().includes(needle));
  }, [countryCode, query]);

  const handleConfirm = () => {
    if (!selected) return;
    setField("accountPreset", selected.name);
    router.push("/onboarding/success");
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => router.push("/onboarding/usage")} aria-label={t("onboarding.account.back")} style={{ background: "none", border: 0, padding: 4, margin: -4, cursor: "pointer" }}>
          <Icon name="chevron-left" size={22} color="var(--text-secondary)" />
        </button>
        <ProgressSteps
          current={3}
          total={3}
          onSkip={() => {
            setField("accountPreset", "Efectivo");
            router.push("/onboarding/success");
          }}
          skipLabel={t("ds.progressSteps.skip")}
        />
      </div>

      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.account.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.account.subtitle")}
        </p>
      </div>

      <Input placeholder={t("onboarding.account.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {presets.map((p) => (
          <InstitutionTile key={p.name} name={p.name} fallbackIcon={p.kind === "cash" ? "banknote" : p.kind === "wallet" ? "wallet" : "bank"} selected={selected?.name === p.name} onClick={() => setSelected(p)} />
        ))}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button disabled={!selected} onClick={handleConfirm}>{t("onboarding.account.continue")}</Button>
      </div>
    </ScreenShell>
  );
}
