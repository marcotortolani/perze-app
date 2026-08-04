import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { transactionsRepo } from "@/lib/repos/transactions-repo";

/**
 * Borra un movimiento y ofrece "Deshacer" por sonner — el mismo par
 * `softDelete`/`restore` estaba copiado en `/transactions` (lista) y
 * `/transactions/[id]` (detalle); acá vive una sola vez para que el swipe
 * del home lo reuse sin triplicarlo de nuevo.
 */
export function useDeleteTransactionWithUndo(householdId: string | undefined) {
  const t = useTranslations();
  const invalidateTransactions = useInvalidateAfterTransactionWrite(householdId);

  return async (id: string) => {
    await transactionsRepo.softDelete(id);
    invalidateTransactions();
    toast(t("transactions.list.deleted"), {
      duration: 5000,
      action: {
        label: t("transactions.list.undo"),
        onClick: async () => {
          await transactionsRepo.restore(id);
          invalidateTransactions();
        },
      },
    });
  };
}
