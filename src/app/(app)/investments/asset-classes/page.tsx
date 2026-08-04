"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, DragRow, Input, ListRow, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAssetClasses, useInvalidateAssetClasses } from "@/hooks/use-investments";
import { instrumentsRepo, type AssetClass } from "@/lib/repos/instruments-repo";

/** I8 — clases de activo: CRUD con orden. Las plantillas globales se editan por clonado (Patrón C), nunca se mutan directo. */
export default function AssetClassesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: assetClasses } = useAssetClasses();
  const invalidate = useInvalidateAssetClasses();
  const [editing, setEditing] = useState<AssetClass | null>(null);
  const [editingName, setEditingName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  usePageHeader({ title: t("assetClassesPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  if (!household || !assetClasses) return <Skeleton height={320} style={{ marginTop: 16 }} />;

  const sorted = [...assetClasses].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    const next = [...sorted];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved!);
    await instrumentsRepo.reorder(next.map((ac, i) => ({ id: ac.id, sortOrder: i })));
    invalidate();
  };

  const openEdit = (assetClass: AssetClass) => {
    setEditing(assetClass);
    setEditingName(assetClass.name);
  };

  const handleSaveEdit = async () => {
    if (!editing || !editingName.trim() || saving) return;
    setSaving(true);
    try {
      if (editing.householdId === null) {
        await instrumentsRepo.cloneForEdit(editing, household.id, { name: editingName.trim() });
      } else {
        await instrumentsRepo.updateOwn(editing.id, { name: editingName.trim() });
      }
      invalidate();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing.householdId === null || saving) return;
    setSaving(true);
    try {
      await instrumentsRepo.deleteOwn(editing.id);
      invalidate();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await instrumentsRepo.createCustom(household.id, newName.trim(), sorted.length);
      invalidate();
      setNewName("");
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        {sorted.map((assetClass, index) => (
          <DragRow key={assetClass.id} id={assetClass.id} index={index} onReorder={handleReorder} dragLabel={t("assetClassesPage.reorder", { name: assetClass.name })}>
            <ListRow label={assetClass.name} meta={assetClass.householdId === null ? t("assetClassesPage.global") : undefined} onClick={() => openEdit(assetClass)} />
          </DragRow>
        ))}
        <ListRow icon="plus" label={t("assetClassesPage.newClass")} variant="action" onClick={() => setCreating(true)} />
      </div>

      <Sheet open={editing !== null} title={t("assetClassesPage.editTitle")} onClose={() => setEditing(null)} height={editing?.householdId !== null ? 320 : 240}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {editing.householdId === null ? (
              <p className="t-caption" style={{ color: "var(--text-muted)" }}>{t("assetClassesPage.globalEditNote")}</p>
            ) : null}
            <Input label={t("assetClassesPage.name")} value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
            <Button disabled={!editingName.trim() || saving} onClick={handleSaveEdit}>
              {t("common.save")}
            </Button>
            {editing.householdId !== null ? (
              <Button variant="danger" disabled={saving} onClick={handleDelete}>
                {t("common.delete")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet open={creating} title={t("assetClassesPage.newClass")} onClose={() => setCreating(false)} height={240}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label={t("assetClassesPage.name")} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <Button disabled={!newName.trim() || saving} onClick={handleCreate}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
