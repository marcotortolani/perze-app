"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, EmptyState, StatusBadge } from "@/design-system";
import { getDb } from "@/lib/db/client";
import { outbox } from "@/lib/offline/outbox";
import type { OutboxEntryRow, OutboxStatus } from "@/lib/db/schema";

const BADGE_STATUS: Record<OutboxStatus, "neutral" | "warning" | "critical"> = {
  pending: "neutral",
  syncing: "neutral",
  failed: "warning",
  conflict: "warning",
  dead: "critical",
};

/**
 * C32 — diagnóstico del outbox: qué queda por sincronizar, cuántas veces
 * falló cada entrada y por qué, con reintento manual para lo que llegó a
 * `"dead"` (pasó el techo de reintentos automáticos — C9). Nunca se borra
 * nada acá: salir de la cola solo pasa al sincronizar de verdad.
 */
export default function SyncDiagnosticsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [retrying, setRetrying] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const entries = useLiveQuery(() => getDb().outbox.toCollection().toArray(), []);
  const deadCount = entries?.filter((e) => e.status === "dead").length ?? 0;

  const handleRetry = async (entry: OutboxEntryRow) => {
    if (retrying !== null || entry.id === undefined) return;
    setRetrying(entry.id);
    try {
      await outbox.retry(entry.id);
      toast(t("syncDiagnosticsPage.retried"));
    } finally {
      setRetrying(null);
    }
  };

  // AC-17 — el bug del upsert mataba TODA la cola: después del fix, lo
  // normal es tener muchas entradas `dead` legítimas, no una.
  const handleRetryAllDead = async () => {
    if (retryingAll) return;
    setRetryingAll(true);
    try {
      const count = await outbox.retryAllDead();
      toast(t("syncDiagnosticsPage.retriedAll", { count }));
    } finally {
      setRetryingAll(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("syncDiagnosticsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
        {deadCount > 1 ? (
          <Button variant="secondary" disabled={retryingAll} onClick={handleRetryAllDead}>
            {t("syncDiagnosticsPage.retryAll", { count: deadCount })}
          </Button>
        ) : null}
        {entries === undefined ? null : entries.length === 0 ? (
          <EmptyState message={t("syncDiagnosticsPage.empty")} />
        ) : (
          entries.map((entry) => (
            <div key={entry.id} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="t-body" style={{ color: "var(--text-primary)" }}>
                  {t("syncDiagnosticsPage.entryLabel", { table: entry.table, op: t(`syncDiagnosticsPage.ops.${entry.op}`) })}
                </span>
                <StatusBadge status={BADGE_STATUS[entry.status]}>{t(`syncDiagnosticsPage.statuses.${entry.status}`)}</StatusBadge>
              </div>
              <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                {t("syncDiagnosticsPage.createdAt", { when: new Date(entry.createdAt).toLocaleString() })}
              </div>
              {entry.attempts > 0 ? (
                <div className="t-caption" style={{ color: "var(--text-muted)" }}>
                  {t("syncDiagnosticsPage.attempts", { count: entry.attempts })}
                </div>
              ) : null}
              {entry.lastError ? (
                <div className="t-caption" style={{ color: "var(--critical)" }}>
                  {entry.lastError}
                </div>
              ) : null}
              {entry.status === "dead" ? (
                <Button variant="secondary" disabled={retrying === entry.id} onClick={() => handleRetry(entry)}>
                  {t("syncDiagnosticsPage.retry")}
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
