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
  /** CON-29: el monograma se pinta sobre este color — nunca el logo real de la institución. */
  color: string;
}

const PRESETS_BY_COUNTRY: Record<string, Preset[]> = {
  UY: [
    { name: "Itaú", kind: "savings", color: "#EC7000" },
    { name: "Brou", kind: "checking", color: "#00A19A" },
    { name: "Santander", kind: "checking", color: "#EC0000" },
    { name: "Mercado Pago", kind: "wallet", color: "#009EE3" },
    { name: "Prex", kind: "wallet", color: "#7B2FF7" },
  ],
  AR: [
    { name: "Banco Nación", kind: "checking", color: "#0072BC" },
    { name: "Mercado Pago", kind: "wallet", color: "#009EE3" },
    { name: "Ualá", kind: "wallet", color: "#191A3F" },
    { name: "Banco Galicia", kind: "checking", color: "#FF5000" },
  ],
  BR: [
    { name: "Nubank", kind: "checking", color: "#820AD1" },
    { name: "Itaú", kind: "checking", color: "#EC7000" },
    { name: "PicPay", kind: "wallet", color: "#21C25E" },
  ],
  US: [
    { name: "Chase", kind: "checking", color: "#117ACA" },
    { name: "Bank of America", kind: "checking", color: "#E31837" },
    { name: "PayPal", kind: "wallet", color: "#003087" },
  ],
  MX: [
    { name: "BBVA", kind: "checking", color: "#004481" },
    { name: "Mercado Pago", kind: "wallet", color: "#009EE3" },
  ],
  CL: [
    { name: "Banco de Chile", kind: "checking", color: "#003DA5" },
    { name: "Mercado Pago", kind: "wallet", color: "#009EE3" },
  ],
};

// "Efectivo" y "Otro" quedan sin traducir a propósito: `accountPreset` los
// guarda como string y `onboarding/success/page.tsx` los vuelve a comparar
// literal contra "Efectivo" para inferir el `AccountKind` — cambiar el
// texto acá rompería esa inferencia. Traducir esto bien requiere separar
// identidad (`kind`) de label en el store, fuera del alcance de i18n.
const ALWAYS: Preset[] = [
  { name: "Efectivo", kind: "cash", color: "#6E6E76" },
  { name: "Otro", kind: "other", color: "#6E6E76" },
];

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
          <InstitutionTile key={p.name} name={p.name} color={p.color} selected={selected?.name === p.name} onClick={() => setSelected(p)} />
        ))}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button disabled={!selected} onClick={handleConfirm}>{t("onboarding.account.continue")}</Button>
      </div>
    </ScreenShell>
  );
}
