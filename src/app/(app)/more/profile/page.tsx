"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, ListRow, Sheet, Skeleton, usePageHeader, ZMark } from "@/design-system";
import { useEffectiveUserId, useCurrentUserEmail } from "@/hooks/use-current-user";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { COUNTRIES, COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { ageFromBirthDate } from "@/lib/analytics/age";

/**
 * K2 — perfil: solo datos de la persona (nombre, email, fecha de
 * nacimiento, país). Idioma y tema vivieron acá una temporada (B7/K3 del
 * diseño los separaba; una decisión de producto los reagrupó en Perfil) —
 * ahora vuelven a Ajustes, que es donde son preferencias de la app, no
 * datos del usuario. El email es de solo lectura — es el dato de
 * identificación de `auth.users`, cambiarlo requiere confirmación y queda
 * fuera de alcance de esta versión. País aplica al tocar la opción, igual
 * que el resto de los selectores de Ajustes; nombre y fecha de nacimiento
 * comparten un botón Guardar porque son texto libre, no una elección de
 * una lista.
 */
export default function ProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const email = useCurrentUserEmail();
  const profileQuery = useQuery({ queryKey: ["profile", userId], queryFn: () => profilesRepo.getOwn(userId!), enabled: !!userId });

  const [name, setName] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [countryPending, setCountryPending] = useState(false);
  usePageHeader({ title: t("profilePage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (profileQuery.isLoading || !userId) return <Skeleton height={400} style={{ marginTop: 16 }} />;

  const displayName = name ?? profileQuery.data?.displayName ?? "";
  const currentBirthDate = birthDate ?? profileQuery.data?.birthDate ?? "";
  const country = COUNTRIES.find((c) => c.code === profileQuery.data?.country);

  const dirty = displayName.trim() !== (profileQuery.data?.displayName ?? "") || currentBirthDate !== (profileQuery.data?.birthDate ?? "");

  const handleSave = async () => {
    if (!displayName.trim() || saving || !dirty) return;
    setSaving(true);
    try {
      await Promise.all([
        profilesRepo.updateDisplayName(userId, displayName.trim()),
        profilesRepo.updateBirthDate(userId, currentBirthDate || null),
      ]);
      toast(t("profilePage.saved"));
      profileQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCountry = async (code: string) => {
    if (countryPending || code === profileQuery.data?.country) {
      setCountrySheetOpen(false);
      return;
    }
    setCountryPending(true);
    try {
      await profilesRepo.updateCountry(userId, code);
      await profileQuery.refetch();
      setCountrySheetOpen(false);
    } finally {
      setCountryPending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Son pocos campos y entran sin scroll — van todos juntos a la
          izquierda en vez de partirse en dos columnas de contenido real (eso
          dejaba la derecha con nada más que "País"). La columna derecha pasa
          a ser una marca, no contenido — el `ZMark` animado. La clase de
          grid va en el `className`, nunca junto a un `display` inline — un
          inline `style` siempre le gana a cualquier clase. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ paddingTop: 16, gap: 24, paddingBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t("profilePage.displayName")} value={displayName} onChange={(e) => setName(e.target.value)} />
          <Input label={t("profilePage.email")} value={email ?? ""} readOnly hint={t("profilePage.emailHint")} />
          <Input
            label={t("profilePage.birthDate")}
            type="date"
            value={currentBirthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            hint={currentBirthDate ? t("profilePage.ageHint", { age: ageFromBirthDate(currentBirthDate) }) : t("profilePage.birthDateHint")}
          />
          <Button disabled={!displayName.trim() || saving || !dirty} onClick={handleSave}>
            {t("common.save")}
          </Button>

          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <ListRow
              icon="flag"
              label={t("profilePage.country")}
              value={country ? t(COUNTRY_MESSAGE_KEY[country.code as keyof typeof COUNTRY_MESSAGE_KEY]) : t("profilePage.countryUnset")}
              variant="value"
              disabled={countryPending}
              onClick={() => setCountrySheetOpen(true)}
            />
          </div>
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>

      <Sheet open={countrySheetOpen} title={t("profilePage.countrySheetTitle")} onClose={() => setCountrySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {COUNTRIES.map((c) => (
            <ListRow
              key={c.code}
              label={t(COUNTRY_MESSAGE_KEY[c.code as keyof typeof COUNTRY_MESSAGE_KEY])}
              variant="value"
              value={c.code === profileQuery.data?.country ? "✓" : undefined}
              disabled={countryPending}
              onClick={() => handleSelectCountry(c.code)}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
