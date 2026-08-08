"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, ListRow, Sheet, StatusBadge, usePageHeader, ZMark } from "@/design-system";
import { HouseholdSwitcherSheet } from "@/components/household-switcher-sheet";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useNavStore } from "@/stores/nav-store";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useConflicts } from "@/hooks/use-conflicts";
import { useOwnAccess } from "@/hooks/use-own-access";
import { usePendingAccessRequestsCount } from "@/hooks/use-pending-access-requests";
import { usePwaStore } from "@/stores/pwa-store";
import { detectInstallPlatform, isStandalonePwa, type InstallPlatform } from "@/lib/pwa/platform";
import { APP_VERSION } from "@/lib/version";
import { countUnsyncedChanges, signOut } from "@/lib/auth/sign-out";
import { exitDemoMode, isDemoModeActive } from "@/lib/demo/demo-mode";

const CAPTION_STYLE = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  lineHeight: "16px",
  fontWeight: 600,
  letterSpacing: ".08em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
  padding: "0 4px 4px",
};

/** Índice de secciones (B7) — Bloque B, Fase 6. Los módulos apagados no aparecen. */
export default function MorePage() {
  const t = useTranslations();
  // En escritorio esta pantalla ES la de Sistema (ver el comentario del grid
  // más abajo), así que el header la nombra por lo que muestra. Acá sí va
  // `useIsDesktop()` y no CSS porque es un string, no layout: cuesta un frame
  // con "Más" antes de hidratar, que es preferible a duplicar el `<h1>`.
  const isDesktop = useIsDesktop();
  usePageHeader({ title: isDesktop ? t("morePage.system") : t("nav.more") });
  const { ref: scrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { conflicts } = useConflicts(household?.id);
  const ownAccess = useOwnAccess();
  const pendingAccessRequests = usePendingAccessRequestsCount();
  const fourthTab = useNavStore((s) => s.fourthTab);
  const modules = household?.enabledModules ?? [];
  const [signOutSheet, setSignOutSheet] = useState<"none" | "confirm" | "signing-out">("none");
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const deferredPrompt = usePwaStore((s) => s.deferredPrompt);
  const setDeferredPrompt = usePwaStore((s) => s.setDeferredPrompt);
  const [installState, setInstallState] = useState<{ platform: InstallPlatform; standalone: boolean } | null>(null);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [householdSwitcherOpen, setHouseholdSwitcherOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee `navigator`/`matchMedia`, no existe en SSR.
    setInstallState({ platform: detectInstallPlatform(), standalone: isStandalonePwa() });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      if (installing) return;
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === "accepted") toast(t("settingsPage.installAccepted"));
      } finally {
        setInstalling(false);
      }
      return;
    }
    setInstallSheetOpen(true);
  };

  const handleSignOutRequest = async () => {
    const count = await countUnsyncedChanges();
    if (count > 0) {
      setUnsyncedCount(count);
      setSignOutSheet("confirm");
      return;
    }
    await doSignOut();
  };

  const doSignOut = async () => {
    setSignOutSheet("signing-out");
    await signOut();
    router.replace("/onboarding");
  };

  const demoActive = isDemoModeActive();

  // §0 — el demo no tiene sesión ni cambios sin sincronizar (el outbox
  // queda vacío a propósito): salir es una acción directa, sin la hoja de
  // confirmación de `signOut()`. No hay nada real que perder.
  const handleExitDemo = async () => {
    await exitDemoMode();
    router.replace("/onboarding");
  };

  return (
    // `scroll-fade-bottom`: esta pantalla pasa a manejar su propio scroll
    // (antes dependía del `<main>` compartido del shell) para tener el
    // mismo fade de `/accounts` — sumada a `OWN_SCROLLER_ROUTES` en
    // `(app)/layout.tsx`.
    <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", height: "100%", minHeight: 0 } as CSSProperties}>
      <div
        ref={scrollerRef}
        className="pb-[calc(var(--block-gap)_+_18px)] lg:pb-8 scroll-gutter-right"
        style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 20, paddingTop: 8 }}
      >
      {/* Household switcher — arriba de todo, visible en mobile y desktop
          por igual (fuera de la columna `lg:hidden` de abajo). No en el tab
          bar ni en el camino de `/`, `/add`: cambiar de hogar es una acción
          rara y deliberada, no parte del flujo de cargar un gasto. */}
      {household ? (
        <section>
          <Card padding="4px 16px">
            <ListRow icon="users" label={t("householdSwitcher.rowLabel")} value={household.name} onClick={() => setHouseholdSwitcherOpen(true)} />
          </Card>
        </section>
      ) : null}

      {/* En `lg`+ esta página es la de SISTEMA y nada más: DINERO y PERSONAS
          ya están en el sidebar, al costado, y repetirlos acá era mostrar dos
          veces lo mismo en la misma pantalla. En móvil no hay sidebar y esta
          es la única puerta a todo, así que se muestra completa.

          Se oculta por CSS (`lg:hidden`) y no con `useIsDesktop()`: ese hook
          devuelve `false` en el snapshot de servidor, así que habría un frame
          con la lista larga antes de hidratar. Mismo criterio que el
          `hidden lg:flex` con el que `(app)/layout.tsx` oculta el sidebar. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 20 }}>
        {/* `display` por clase y no inline: un `style={{display:"flex"}}`
            le gana por especificidad a `lg:hidden` y la columna no se
            ocultaba. `gap-5` = 20px en la escala de Tailwind v4. */}
        <div className="flex flex-col gap-5 lg:hidden">
          <section>
            <div style={CAPTION_STYLE}>{t("morePage.money")}</div>
            <Card padding="4px 16px">
              {/* Analysis/Accounts/Investments/Budgets son los cuatro
                  candidatos al 4to slot del tab bar (`FourthTab`,
                  `nav-store.ts`). El que está puesto ahí no se repite acá,
                  y el que se sacó SIEMPRE tiene que reaparecer — antes
                  Accounts/Investments/Budgets se mostraban sin chequear
                  `fourthTab` (se duplicaban) y Analysis no tenía fila
                  propia en ningún lado (desaparecía del todo al dejar de
                  ser el 4to tab). */}
              {fourthTab !== "analytics" ? <ListRow icon="chart" label={t("nav.analysis")} onClick={() => router.push("/analytics")} /> : null}
              {fourthTab !== "accounts" ? <ListRow icon="wallet" label={t("morePage.accounts")} onClick={() => router.push("/accounts")} /> : null}
              {modules.includes("budgets") && fourthTab !== "budgets" ? <ListRow icon="target" label={t("morePage.budgets")} onClick={() => router.push("/budgets")} /> : null}
              {modules.includes("goals") ? <ListRow icon="flag" label={t("morePage.goals")} onClick={() => router.push("/goals")} /> : null}
              {modules.includes("recurring") ? <ListRow icon="refresh" label={t("morePage.recurring")} onClick={() => router.push("/recurring")} /> : null}
              {modules.includes("debts") ? <ListRow icon="handshake" label={t("morePage.debts")} onClick={() => router.push("/debts")} /> : null}
              {modules.includes("investments") && fourthTab !== "investments" ? <ListRow icon="invest" label={t("nav.investments")} onClick={() => router.push("/investments")} /> : null}
              <ListRow icon="square-half" label={t("morePage.categories")} onClick={() => router.push("/more/categories")} />
              <ListRow icon="tag" label={t("morePage.tagsAndPayees")} onClick={() => router.push("/more/tags")} />
              <ListRow icon="refresh" label={t("morePage.rules")} onClick={() => router.push("/more/rules")} />
            </Card>
          </section>

          {modules.includes("family") ? (
            <section>
              <div style={CAPTION_STYLE}>{t("morePage.people")}</div>
              <Card padding="4px 16px">
                <ListRow icon="users" label={t("morePage.family")} onClick={() => router.push("/family")} />
              </Card>
            </section>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section>
            <div style={CAPTION_STYLE}>{t("morePage.system")}</div>
            <Card padding="4px 16px">
              <ListRow icon="user" label={t("morePage.profile")} onClick={() => router.push("/more/profile")} />
              <ListRow icon="lock" label={t("morePage.security")} onClick={() => router.push("/more/security")} />
              <ListRow icon="alert" label={t("notificationsPage.title")} onClick={() => router.push("/more/notifications")} />
              <ListRow
                icon="refresh"
                label={t("syncDiagnosticsPage.title")}
                chevron
                value={conflicts.length > 0 ? <StatusBadge status="critical">{t("conflictsPage.badgeCount", { count: conflicts.length })}</StatusBadge> : undefined}
                onClick={() => router.push("/more/sync")}
              />
              <ListRow icon="edit" label={t("morePage.settings")} onClick={() => router.push("/more/settings")} />
              <ListRow icon="plus" label={t("morePage.enableMoreFeatures")} variant="action" onClick={() => router.push("/more/modules")} />
              {installState?.standalone ? (
                <ListRow icon="check" label={t("settingsPage.installedAlready")} value="✓" chevron={false} />
              ) : installState ? (
                <ListRow icon="install" label={t("settingsPage.install")} disabled={installing} onClick={handleInstall} />
              ) : null}
              <ListRow icon="install" label={t("morePage.dataAndBackup")} onClick={() => router.push("/more/data")} />
              <ListRow icon="mail" label={t("morePage.about")} onClick={() => router.push("/more/about")} />
              {/* El panel del operador vive DENTRO de Sistema, no en una
                  tarjeta suelta debajo: es una sección de sistema más, y
                  aislada parecía una categoría propia de un solo ítem. */}
              {ownAccess?.isAppAdmin ? (
                <ListRow
                  icon="lock"
                  label={t("adminPage.title")}
                  meta={pendingAccessRequests > 0 ? t("ds.tabBar.accessRequestsBadge", { count: pendingAccessRequests }) : undefined}
                  onClick={() => router.push("/more/admin")}
                />
              ) : null}
            </Card>
          </section>

          <Card padding="4px 16px">
            {demoActive ? (
              <ListRow icon="sign-out" label={t("morePage.exitDemo")} onClick={handleExitDemo} />
            ) : (
              <ListRow icon="sign-out" label={t("morePage.signOut")} onClick={handleSignOutRequest} />
            )}
          </Card>
        </div>

        {/* En `lg`+ la primera columna está oculta, así que SISTEMA cae a la
            izquierda y esta quedaría vacía — con la línea de versión de abajo
            centrada respecto del grid entero, o sea descentrada respecto de
            lo único que se ve. Se llena con el `ZMark`, mismo tratamiento que
            `debts/new`, `goals/new`, `family/invite` y `more/profile`: la
            variante `flip` está documentada en el contrato como relleno
            decorativo de columnas vacías, no como loader. La versión pasa a
            vivir acá debajo, ya centrada en su propia columna. */}
        <div className="hidden lg:flex" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
          <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)" }}>
            {t("morePage.version", { version: APP_VERSION })}
          </p>
        </div>
      </div>

      {/* En móvil no hay segunda columna donde ponerla: queda al pie, como siempre. */}
      <p className="t-caption lg:hidden" style={{ textAlign: "center", color: "var(--text-muted)" }}>
        {t("morePage.version", { version: APP_VERSION })}
      </p>
      </div>

      <Sheet open={signOutSheet === "confirm"} title={t("morePage.signOutConfirmTitle")} onClose={() => setSignOutSheet("none")} height={260}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {t("morePage.signOutUnsyncedWarning", { count: unsyncedCount })}
          </p>
          <button
            type="button"
            onClick={doSignOut}
            style={{ background: "var(--critical)", color: "var(--primary-on-fill)", border: 0, borderRadius: "var(--radius-button)", height: 56, cursor: "pointer", fontSize: 17, fontWeight: 600 }}
          >
            {t("morePage.signOutConfirmAction")}
          </button>
          <button
            type="button"
            onClick={() => setSignOutSheet("none")}
            style={{ background: "none", border: 0, cursor: "pointer", fontSize: 15, color: "var(--text-secondary)", padding: 8 }}
          >
            {t("common.cancel")}
          </button>
        </div>
      </Sheet>

      <Sheet open={installSheetOpen} title={t("settingsPage.install")} onClose={() => setInstallSheetOpen(false)}>
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {t(`settingsPage.installGuide.${installState?.platform ?? "other"}`)}
        </p>
      </Sheet>

      <HouseholdSwitcherSheet open={householdSwitcherOpen} onClose={() => setHouseholdSwitcherOpen(false)} />
    </div>
  );
}
