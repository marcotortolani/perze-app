"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getDb } from "@/lib/db/client";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { todayIso } from "@/lib/dates/today";
import { materializeDueRecurring } from "./materialize";

const THROTTLE_META_KEY = "recurringMaterializedAt";
const ANNOUNCED_META_KEY = "recurringAnnouncedAt";
const THROTTLE_MS = 60 * 60 * 1000;

async function getMeta(key: string): Promise<string | null> {
  return ((await getDb().meta.get(key))?.value as string | undefined) ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  await getDb().meta.put({ key, value });
}

/**
 * Motor cliente de recurrentes (§ B del plan) + el aviso de deshacer del
 * cron (§ F): una ventana de 5s que arranca cuando el movimiento se crea
 * mientras el usuario no está mirando la app no es una promesa que se
 * pueda cumplir, así que acá se redefine CUÁNDO arranca la ventana — 5s
 * desde que se avisa, no desde que la fila existe. Se dispara al montar
 * (después del primer pull, para ver lo que ya materializó el cron) y al
 * volver de background, con throttle de una hora vía Dexie `meta`.
 */
export function useRecurringMaterializer(): void {
  const t = useTranslations();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!household || !userId) return;

    async function run() {
      // D10 — `todayIso()`, no `new Date().toISOString().slice(0, 10)`: ese
      // patrón toma el día en UTC, que en un huso negativo (Uruguay,
      // Argentina) adelanta la fecha entre las 21:00 y las 00:00 locales.
      const today = todayIso();
      const lastRun = await getMeta(THROTTLE_META_KEY);
      if (lastRun && Date.now() - Date.parse(lastRun) < THROTTLE_MS) return;

      const created = await materializeDueRecurring(household!, userId!, today);
      await setMeta(THROTTLE_META_KEY, new Date().toISOString());
      if (created.length > 0) invalidateTransactions();

      // Anuncio agregado — incluye tanto lo que este motor acaba de crear
      // como lo que el cron haya materializado desde el último aviso (se ve
      // recién ahora porque el pull de `useSyncLoop` lo trajo a Dexie).
      const announcedAt = await getMeta(ANNOUNCED_META_KEY);
      const rows = await getDb()
        .transactions.where("householdId")
        .equals(household!.id)
        .filter((tx) => tx.source === "recurring" && (!announcedAt || tx.createdAt > announcedAt))
        .toArray();
      await setMeta(ANNOUNCED_META_KEY, new Date().toISOString());
      if (rows.length === 0) return;

      const ids = rows.map((r) => r.id);
      let singleName = "";
      if (rows.length === 1 && rows[0]!.recurringId) {
        const rule = await getDb().recurringRules.get(rows[0]!.recurringId);
        singleName = rule?.name ?? "";
      }
      const message = ids.length === 1 ? t("recurringPage.autoPosted", { name: singleName }) : t("recurringPage.autoPostedMany", { count: ids.length });
      toast(message, {
        duration: 5000,
        action: {
          label: t("recurringPage.undo"),
          onClick: async () => {
            // C24 — secuencial, no Promise.all: dos softDelete sobre la
            // misma cuenta compiten por `currentBalance`.
            for (const id of ids) await transactionsRepo.softDelete(id);
            invalidateTransactions();
          },
        },
      });
    }

    if (!ranRef.current) {
      ranRef.current = true;
      void run();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, userId]);
}
