"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, IconButton, Input, ProgressSteps } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { createClient } from "@/lib/supabase/client";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { BirthDateField, type BirthDateValue } from "@/features/profile/BirthDateField";

/**
 * A4a — nombre y fecha de nacimiento opcional (o solo la edad). El
 * trigger `handle_new_user()` ya completa `display_name` desde el
 * metadata de Google o el prefijo del email, así que este campo suele
 * llegar precargado: acá el usuario lo confirma o lo cambia, no lo
 * escribe desde cero. El nombre es "casi requerido" — el botón se
 * habilita con texto no vacío, y "Saltear" (`ProgressSteps`) es el
 * escape para quien no quiere completarlo ahora.
 */
export default function OnboardingProfilePage() {
  const router = useRouter();
  const t = useTranslations();
  const draftDisplayName = useOnboardingStore((s) => s.draft.displayName);
  const setField = useOnboardingStore((s) => s.setField);
  const [name, setName] = useState(draftDisplayName);
  const [birth, setBirth] = useState<BirthDateValue>({ birthDate: null, precision: null });
  const [prefilled, setPrefilled] = useState(false);

  // Precarga best-effort desde el perfil ya creado por `handle_new_user()`
  // — solo si el draft todavía no tiene nada (evita pisar lo que el
  // usuario ya haya tocado si vuelve atrás a esta pantalla).
  useEffect(() => {
    if (draftDisplayName || prefilled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda para no repetir el fetch, no una sincronización con estado externo.
    setPrefilled(true);
    void (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) return;
      const profile = await profilesRepo.getOwn(user.id).catch(() => null);
      if (profile?.displayName) setName(profile.displayName);
      if (profile?.birthDate) setBirth({ birthDate: profile.birthDate, precision: profile.birthDatePrecision });
    })();
  }, [draftDisplayName, prefilled]);

  const handleContinue = () => {
    setField("displayName", name.trim());

    // Best-effort, nunca bloquea el avance — el draft (línea de arriba) es
    // la fuente que A11 usa igual para crear el `household_member`.
    void (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) return;
      await Promise.all([
        name.trim() ? profilesRepo.updateDisplayName(user.id, name.trim()).catch(() => {}) : Promise.resolve(),
        profilesRepo.updateBirthDate(user.id, birth.birthDate, birth.precision).catch(() => {}),
      ]);
    })();

    router.push("/onboarding/country");
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-left" ariaLabel={t("onboarding.profile.back")} onClick={() => router.push("/onboarding")} style={{ margin: -11 }} />
        <ProgressSteps current={1} total={5} onSkip={() => router.push("/onboarding/country")} skipLabel={t("ds.progressSteps.skip")} />
      </div>

      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.profile.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.profile.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Input
          label={t("onboarding.profile.nameLabel")}
          placeholder={t("onboarding.profile.namePlaceholder")}
          autoComplete="given-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <BirthDateField value={birth} onChange={setBirth} />
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button disabled={!name.trim()} onClick={handleContinue}>
          {t("onboarding.profile.continue")}
        </Button>
      </div>
    </ScreenShell>
  );
}
