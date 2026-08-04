"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, EmptyState, StatusBadge, usePageHeader } from "@/design-system";
import { getDb } from "@/lib/db/client";
import { outbox } from "@/lib/offline/outbox";
import type { OutboxEntryRow, OutboxStatus } from "@/lib/db/schema";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useConflicts } from "@/hooks/use-conflicts";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { conflictsRepo } from "@/lib/repos/conflicts-repo";
import type { ConflictRecordRow } from "@/lib/db/schema";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

const BADGE_STATUS: Record<OutboxStatus, "neutral" | "warning" | "critical"> = {
  pending: "neutral",
  syncing: "neutral",
  failed: "warning",
  conflict: "warning",
  dead: "critical",
};

function summarize(payload: Record<string, unknown>, categoryLabel: (id: string | null) => string): { amount: string; category: string; note: string } {
  const amount = payload.amount !== undefined ? (typeof payload.amount === "bigint" ? payload.amount : BigInt(payload.amount as string)) : 0n;
  const currency = (payload.currencyCode ?? payload.currency_code ?? "UYU") as string;
  const categoryId = (payload.categoryId ?? payload.category_id ?? null) as string | null;
  const note = (payload.note ?? "") as string;
  return { amount: formatAmountCompact(money(amount, currency), { showSign: false }), category: categoryLabel(categoryId), note };
}

/**
 * Sync unificada — antes dos pantallas separadas (Conflictos y Estado de
 * sincronización), reagrupadas por decisión de producto en una sola con
 * dos secciones apiladas: conflictos pendientes arriba (solo si hay), el
 * diagnóstico del outbox siempre abajo. Sin tabs — todo visible en un
 * scroll, porque un conflicto sin resolver es lo más urgente de la
 * pantalla y no debe quedar detrás de un tap extra.
 */
export default function SyncPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { conflicts, refresh } = useConflicts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const [resolving, setResolving] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  usePageHeader({ title: t("syncDiagnosticsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const labelFor = (id: string | null) => (id && categoryById.has(id) ? categoryLabel(categoryById.get(id)!) : t("conflictsPage.noCategory"));

  const entries = useLiveQuery(() => getDb().outbox.toCollection().toArray(), []);
  const deadCount = entries?.filter((e) => e.status === "dead").length ?? 0;

  const handleResolveConflict = async (conflict: ConflictRecordRow, keep: "local" | "server") => {
    if (resolving) return;
    setResolving(conflict.id);
    try {
      if (keep === "local") await conflictsRepo.keepLocal(conflict);
      else await conflictsRepo.keepServer(conflict);
      invalidateTransactions();
      await refresh();
      toast(t("conflictsPage.resolved"));
    } finally {
      setResolving(null);
    }
  };

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
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
        {conflicts.length > 0 ? (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("conflictsPage.title")}</div>
            {conflicts.map((conflict) => {
              const mine = summarize(conflict.localPayload, labelFor);
              const theirs = summarize(conflict.serverPayload, labelFor);
              return (
                <div key={conflict.id} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <p className="t-body" style={{ margin: 0, color: "var(--text-primary)" }}>{t("conflictsPage.explainer")}</p>

                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "var(--radius-input)", padding: 12 }}>
                      <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("conflictsPage.yours")}</div>
                      <div style={{ marginTop: 4, fontSize: 15, color: "var(--text-primary)" }}>{mine.amount}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{mine.category}</div>
                      {mine.note ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{mine.note}</div> : null}
                    </div>
                    <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "var(--radius-input)", padding: 12 }}>
                      <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("conflictsPage.theirs")}</div>
                      <div style={{ marginTop: 4, fontSize: 15, color: "var(--text-primary)" }}>{theirs.amount}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{theirs.category}</div>
                      {theirs.note ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{theirs.note}</div> : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="secondary" disabled={resolving === conflict.id} onClick={() => handleResolveConflict(conflict, "local")} style={{ flex: 1 }}>
                      {t("conflictsPage.keepMine")}
                    </Button>
                    <Button variant="secondary" disabled={resolving === conflict.id} onClick={() => handleResolveConflict(conflict, "server")} style={{ flex: 1 }}>
                      {t("conflictsPage.keepTheirs")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("syncDiagnosticsPage.outboxSection")}</div>
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
        </section>
      </div>
    </div>
  );
}
