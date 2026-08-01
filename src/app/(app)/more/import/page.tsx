"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, ColumnMappingRow, CsvPreviewTable, EmptyState, ListRow, Sheet, Skeleton, StatusBadge } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAccounts, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useTransactions, useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { parseCsv } from "@/lib/import/csv-parser";
import { applyColumnMapping, guessColumnMapping, type ColumnMapping, type ImportField, type ImportedRow } from "@/lib/import/column-mapping";
import { detectDuplicates, type DedupedRow } from "@/lib/import/duplicate-detection";
import { createImportedTransactions } from "@/lib/import/create-imported-transactions";
import { importBatchesRepo } from "@/lib/repos/import-batches-repo";
import { decimalsFor } from "@/lib/money/decimals";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

type Step = "file" | "columns" | "duplicates" | "done";
const FIELDS: ImportField[] = ["date", "description", "amount"];

/** K9 — importador CSV: K9a archivo, K9b columnas, K9c duplicados, en una sola pantalla con pasos internos (evita serializar el archivo entre rutas). */
export default function ImportCsvPage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);

  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappingField, setMappingField] = useState<ImportField | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [dedupedRows, setDedupedRows] = useState<DedupedRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const { data: existingTransactions } = useTransactions(household?.id, accountId ? { accountId } : undefined);

  const account = accounts.find((a) => a.id === accountId);
  const importedRows: ImportedRow[] = useMemo(() => applyColumnMapping(dataRows, mapping), [dataRows, mapping]);

  if (!household || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) return;
    setFileName(file.name);
    setHeaders(parsed[0]!);
    setDataRows(parsed.slice(1));
    const guessNameMatch = accounts.find((a) => file.name.toLowerCase().includes(a.name.toLowerCase().slice(0, 4)));
    if (guessNameMatch) setAccountId(guessNameMatch.id);
  };

  const handleContinueFromFile = async () => {
    if (!account || dataRows.length === 0) return;
    const batch = await importBatchesRepo.create(household.id, fileName ?? "import.csv");
    setBatchId(batch.id);
    const filePrefix = (fileName ?? "").split(/[-_.\s]/)[0] ?? "";
    const reused = filePrefix ? await importBatchesRepo.findLastMappingForFilenamePattern(household.id, filePrefix) : null;
    setMapping(reused ?? guessColumnMapping(headers));
    setStep("columns");
  };

  const handleContinueFromColumns = async () => {
    if (!batchId || !account) return;
    await importBatchesRepo.saveMapping(batchId, mapping);
    const decimals = decimalsFor(account.currencyCode);
    const existing = (existingTransactions ?? []).map((tx) => ({ occurredAt: tx.occurredAt, amount: tx.amount }));
    const deduped = detectDuplicates(importedRows, existing, decimals);
    setDedupedRows(deduped);
    setExcluded(new Set(deduped.map((d, i) => (d.isDuplicate ? i : -1)).filter((i) => i >= 0)));
    setStep("duplicates");
  };

  const handleImport = async () => {
    if (!batchId || !account || importing) return;
    setImporting(true);
    try {
      const rowsToImport = dedupedRows.filter((_, i) => !excluded.has(i)).map((d) => d.row);
      const created = await createImportedTransactions(rowsToImport, household, account, userId);
      await importBatchesRepo.complete(batchId, created);
      invalidateAccounts();
      invalidateTransactions();
      toast(t("importCsvPage.imported", { count: created }));
      setStep("done");
    } finally {
      setImporting(false);
    }
  };

  const toggleExcluded = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (step === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <AppHeader title={t("importCsvPage.title")} showScope={false} onBack={() => router.push("/transactions")} backLabel={t("ds.appHeader.back")} />
        <EmptyState message={t("importCsvPage.done")} actionLabel={t("importCsvPage.viewTransactions")} onAction={() => router.push("/transactions")} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("importCsvPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24, flex: 1 }}>
        {step === "file" ? (
          <>
            <label style={{ display: "block", background: "var(--surface-2)", borderRadius: "var(--radius-card)", padding: 20, textAlign: "center", cursor: "pointer" }}>
              <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{fileName ?? t("importCsvPage.chooseFile")}</span>
            </label>

            {dataRows.length > 0 ? (
              <>
                <div style={{ textAlign: "center" }}>
                  <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("importCsvPage.weRead")}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 600 }}>{dataRows.length}</div>
                </div>

                <button type="button" onClick={() => setAccountSheetOpen(true)} style={{ background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, textAlign: "left", cursor: "pointer" }}>
                  <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("importCsvPage.destinationAccount")}</div>
                  <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("goalsPage.chooseAccount")}</div>
                </button>

                <CsvPreviewTable headers={headers} rows={dataRows} />

                <Button disabled={!account} onClick={handleContinueFromFile} style={{ marginTop: "auto" }}>
                  {t("common.continue")}
                </Button>
              </>
            ) : null}
          </>
        ) : null}

        {step === "columns" ? (
          <>
            <p className="t-body" style={{ color: "var(--text-secondary)" }}>{t("importCsvPage.mapColumns")}</p>
            {FIELDS.map((field) => (
              <ColumnMappingRow
                key={field}
                rawHeader={t(`importCsvPage.field.${field}`)}
                destination={mapping[field] !== undefined ? headers[mapping[field]!] ?? null : null}
                onClick={() => setMappingField(field)}
              />
            ))}
            <Button disabled={mapping.date === undefined || mapping.amount === undefined} onClick={handleContinueFromColumns} style={{ marginTop: "auto" }}>
              {t("common.continue")}
            </Button>
          </>
        ) : null}

        {step === "duplicates" ? (
          <>
            <p className="t-body" style={{ color: "var(--text-secondary)" }}>
              {t("importCsvPage.duplicatesFound", { count: dedupedRows.filter((d) => d.isDuplicate).length })}
            </p>
            {dedupedRows.map((d, i) => (
              <ListRow
                key={i}
                label={d.row.description || t("importCsvPage.noDescription")}
                meta={d.row.date}
                variant="value"
                value={
                  <div style={{ textAlign: "right" }}>
                    <span>{formatAmountCompact(money(BigInt(Math.round(d.row.amount * 10 ** decimalsFor(account?.currencyCode ?? household.baseCurrency))), account?.currencyCode ?? household.baseCurrency), { showSign: false })}</span>
                    {d.isDuplicate ? (
                      <div style={{ marginTop: 2 }}>
                        <StatusBadge status="neutral">{t("importCsvPage.duplicate")}</StatusBadge>
                      </div>
                    ) : null}
                  </div>
                }
                onClick={() => toggleExcluded(i)}
                style={{ opacity: excluded.has(i) ? 0.4 : 1 }}
              />
            ))}
            <Button disabled={importing || dedupedRows.length - excluded.size === 0} onClick={handleImport} style={{ marginTop: "auto" }}>
              {t("importCsvPage.importCount", { count: dedupedRows.length - excluded.size })}
            </Button>
          </>
        ) : null}
      </div>

      <Sheet open={accountSheetOpen} title={t("goalsPage.chooseAccount")} onClose={() => setAccountSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a) => (
            <ListRow key={a.id} label={a.name} meta={a.currencyCode} onClick={() => { setAccountId(a.id); setAccountSheetOpen(false); }} />
          ))}
        </div>
      </Sheet>

      <Sheet open={mappingField !== null} title={mappingField ? t(`importCsvPage.field.${mappingField}`) : ""} onClose={() => setMappingField(null)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {headers.map((h, i) => (
            <ListRow key={i} label={h} onClick={() => { if (mappingField) setMapping((m) => ({ ...m, [mappingField]: i })); setMappingField(null); }} />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
