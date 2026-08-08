"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ListRow, Sheet, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useHouseholdsList, useSwitchHousehold } from "@/hooks/use-households-list";

/**
 * Household switcher (PR 3 del plan de multi-household) — compartido entre
 * `/more` y `/family`, que son sus dos puntos de entrada. Fuera del camino
 * caliente a propósito: nunca se monta en `/`, `/add` ni el tab bar, así
 * que no toca la métrica de los 5 segundos. El switch nunca es accidental
 * — tap explícito en una fila de este Sheet, ninguna otra superficie.
 */
export function HouseholdSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const { data: current } = useCurrentHousehold();
  const { data: households, isLoading } = useHouseholdsList();
  const switchHousehold = useSwitchHousehold();
  const [switching, setSwitching] = useState<string | null>(null);

  const handleSwitch = async (householdId: string) => {
    if (switching || householdId === current?.id) {
      onClose();
      return;
    }
    setSwitching(householdId);
    try {
      await switchHousehold(householdId);
      onClose();
      toast(t("householdSwitcher.switched"));
      router.replace("/");
    } catch {
      toast(t("householdSwitcher.switchError"));
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Sheet open={open} title={t("householdSwitcher.sheetTitle")} onClose={() => (switching ? null : onClose())}>
      {isLoading ? (
        <Skeleton height={56} />
      ) : !households || households.length === 0 ? (
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {t("householdSwitcher.empty")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {households.map((h) => (
            <ListRow
              key={h.id}
              icon="users"
              label={h.name}
              value={h.id === current?.id ? "✓" : undefined}
              disabled={!!switching}
              onClick={() => handleSwitch(h.id)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
