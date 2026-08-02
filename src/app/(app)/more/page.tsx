"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, ListRow, Sheet, StatusBadge } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useConflicts } from "@/hooks/use-conflicts";
import { useOwnAccess } from "@/hooks/use-own-access";
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
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { conflicts } = useConflicts(household?.id);
  const ownAccess = useOwnAccess();
  const modules = household?.enabledModules ?? [];
  const [signOutSheet, setSignOutSheet] = useState<"none" | "confirm" | "signing-out">("none");
  const [unsyncedCount, setUnsyncedCount] = useState(0);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8, paddingBottom: 24 }}>
      <section>
        <div style={CAPTION_STYLE}>{t("morePage.money")}</div>
        <Card padding="4px 16px">
          <ListRow icon="wallet" label={t("morePage.accounts")} onClick={() => router.push("/accounts")} />
          {modules.includes("budgets") ? <ListRow icon="target" label={t("morePage.budgets")} onClick={() => router.push("/budgets")} /> : null}
          {modules.includes("goals") ? <ListRow icon="flag" label={t("morePage.goals")} onClick={() => router.push("/goals")} /> : null}
          {modules.includes("recurring") ? <ListRow icon="refresh" label={t("morePage.recurring")} onClick={() => router.push("/recurring")} /> : null}
          {modules.includes("debts") ? <ListRow icon="handshake" label={t("morePage.debts")} onClick={() => router.push("/debts")} /> : null}
          {modules.includes("investments") ? <ListRow icon="invest" label={t("nav.investments")} onClick={() => router.push("/investments")} /> : null}
          <ListRow icon="tag" label={t("morePage.categories")} onClick={() => router.push("/more/categories")} />
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
          <ListRow icon="install" label={t("morePage.dataAndBackup")} onClick={() => router.push("/more/data")} />
          <ListRow icon="mail" label={t("morePage.about")} onClick={() => router.push("/more/about")} />
        </Card>
      </section>

      {ownAccess?.isAppAdmin ? (
        <section>
          <Card padding="4px 16px">
            <ListRow icon="lock" label={t("adminPage.title")} onClick={() => router.push("/more/admin")} />
          </Card>
        </section>
      ) : null}

      <Card padding="4px 16px">
        {demoActive ? (
          <ListRow icon="sign-out" label={t("morePage.exitDemo")} onClick={handleExitDemo} />
        ) : (
          <ListRow icon="sign-out" label={t("morePage.signOut")} onClick={handleSignOutRequest} />
        )}
      </Card>

      <p className="t-caption" style={{ textAlign: "center", color: "var(--text-muted)" }}>
        {t("morePage.version", { version: APP_VERSION })}
      </p>

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
    </div>
  );
}
