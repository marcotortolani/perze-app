import { createClient } from "../supabase/client";
import { newId } from "./ids";
import type { ColumnMapping } from "../import/column-mapping";

export interface ImportBatch {
  id: string;
  householdId: string;
  filename: string;
  mapping: ColumnMapping | null;
  rowCount: number | null;
  status: "pending" | "mapped" | "done";
}

/**
 * K9 — bitácora del importador CSV. Vive solo en Supabase: es un registro
 * operativo del flujo de import (qué archivo, qué mapeo, cuántas filas),
 * no dato que necesite capturarse offline como una transacción.
 */
export const importBatchesRepo = {
  async create(householdId: string, filename: string): Promise<ImportBatch> {
    const supabase = createClient();
    const row = { id: newId(), household_id: householdId, filename, status: "pending" };
    const { error } = await supabase.from("import_batches").insert(row as never);
    if (error) throw error;
    return { id: row.id, householdId, filename, mapping: null, rowCount: null, status: "pending" };
  },

  /** El mapeo se persiste por archivo/banco para que el próximo CSV del mismo banco salte K9b (K9b lo promete explícitamente). */
  async findLastMappingForFilenamePattern(householdId: string, filenamePrefix: string): Promise<ColumnMapping | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("import_batches")
      .select("mapping, filename")
      .eq("household_id", householdId)
      .not("mapping", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const match = (data ?? []).find((row) => row.filename.toLowerCase().startsWith(filenamePrefix.toLowerCase()));
    return (match?.mapping as ColumnMapping | undefined) ?? null;
  },

  async saveMapping(id: string, mapping: ColumnMapping): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("import_batches").update({ mapping: mapping as never, status: "mapped" }).eq("id", id);
    if (error) throw error;
  },

  async complete(id: string, rowCount: number): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("import_batches").update({ row_count: rowCount, status: "done" }).eq("id", id);
    if (error) throw error;
  },
};
