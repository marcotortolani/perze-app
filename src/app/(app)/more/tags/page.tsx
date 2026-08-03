"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, Button, Input, ListRow, Sheet, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInvalidatePayees, usePayees } from "@/hooks/use-payees";
import { useInvalidateTags, useTags } from "@/hooks/use-tags";
import { payeesRepo } from "@/lib/repos/payees-repo";
import { tagsRepo } from "@/lib/repos/tags-repo";

type Kind = "tag" | "payee";
type EditingItem = { kind: Kind; id: string | null; name: string };

/** K6 — tags y comercios: crear, renombrar, borrar. Catálogos de bajo volumen, sin estado vacío especial. */
export default function TagsAndPayeesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: tags } = useTags(household?.id);
  const { data: payees } = usePayees(household?.id);
  const invalidateTags = useInvalidateTags(household?.id);
  const invalidatePayees = useInvalidatePayees(household?.id);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);

  if (!household || !tags || !payees) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const handleSave = async () => {
    if (!editing || !editing.name.trim() || saving) return;
    setSaving(true);
    try {
      if (editing.kind === "tag") {
        if (editing.id) await tagsRepo.rename(editing.id, editing.name.trim());
        else await tagsRepo.create(household.id, editing.name.trim());
        invalidateTags();
      } else {
        if (editing.id) await payeesRepo.update(editing.id, { name: editing.name.trim() });
        else await payeesRepo.create({ householdId: household.id, name: editing.name.trim(), defaultCategoryId: null, defaultAccountId: null, logoUrl: null, aliases: [] });
        invalidatePayees();
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing?.id || saving) return;
    setSaving(true);
    try {
      if (editing.kind === "tag") {
        await tagsRepo.remove(editing.id);
        invalidateTags();
      } else {
        await payeesRepo.remove(editing.id);
        invalidatePayees();
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("tagsPayeesPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
        <section>
          <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 4 }}>{t("tagsPayeesPage.tags")}</div>
          {tags.map((tag) => (
            <ListRow key={tag.id} icon="tag" label={tag.name} onClick={() => setEditing({ kind: "tag", id: tag.id, name: tag.name })} />
          ))}
          <ListRow icon="plus" label={t("tagsPayeesPage.addTag")} variant="action" onClick={() => setEditing({ kind: "tag", id: null, name: "" })} />
        </section>

        <section>
          <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 4 }}>{t("tagsPayeesPage.payees")}</div>
          {payees.map((payee) => (
            <ListRow key={payee.id} icon="storefront" label={payee.name} onClick={() => setEditing({ kind: "payee", id: payee.id, name: payee.name })} />
          ))}
          <ListRow icon="plus" label={t("tagsPayeesPage.addPayee")} variant="action" onClick={() => setEditing({ kind: "payee", id: null, name: "" })} />
        </section>
      </div>

      <Sheet
        open={editing !== null}
        title={t(editing?.id ? "tagsPayeesPage.editTitle" : "tagsPayeesPage.newTitle")}
        onClose={() => setEditing(null)}
        height={editing?.id ? 320 : 240}
      >
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label={t("tagsPayeesPage.name")} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            <Button disabled={!editing.name.trim() || saving} onClick={handleSave}>
              {t("common.save")}
            </Button>
            {editing.id ? (
              <Button variant="danger" disabled={saving} onClick={handleDelete}>
                {t("common.delete")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
