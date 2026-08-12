"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Announcements, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DashboardBlockShell } from "../DashboardBlockShell";
import { HiddenBlocksTray } from "./HiddenBlocksTray";
import { HOME_BLOCK_REGISTRY, HOME_LAYOUT_CATALOG, type HomeBlockId } from "../blocks/registry";
import { useHomeData } from "../home-data";
import { resolveHomeLayout } from "../layout/resolve-layout";
import { hideBlock, moveBlock, resetLayout, showBlock } from "../layout/layout-actions";
import type { StoredHomeLayoutDoc } from "../layout/types";
import { useMotionIntensity } from "@/components/motion/use-motion-intensity";

const COLUMN_STYLE: CSSProperties = { display: "flex", flexDirection: "column", gap: 12, minWidth: 0, minHeight: 44 };

export interface HomeLayoutEditorProps {
  /** Estado controlado — vive en `HomeBlocksLayout`, no acá, porque el botón "Listo" del header (fuera de este árbol) es quien dispara el guardado al salir. */
  doc: StoredHomeLayoutDoc;
  onChange: (doc: StoredHomeLayoutDoc) => void;
  /** `marginTop` de los banners (cumpleaños/offline/conflicto) — lo calcula `HomeBlocksLayout`, que es quien conoce esos flags. */
  style?: CSSProperties;
}

/**
 * Único archivo que importa `@dnd-kit` — `HomeBlocksLayout` lo carga con
 * `dynamic(..., { ssr: false })` solo cuando `editing && isDesktop`, así
 * que el chunk (~38 kB gzip) nunca llega a mobile. Componente controlado:
 * cada acción (drag, ocultar, mostrar, restablecer) llama a `onChange` con
 * el doc resultante — el guardado al servidor (una sola vez, no por drop)
 * lo dispara el "Listo" del header, que lee ese mismo doc desde arriba.
 */
export default function HomeLayoutEditor({ doc, onChange, style }: HomeLayoutEditorProps) {
  const t = useTranslations();
  const homeData = useHomeData();
  const motionIntensity = useMotionIntensity();
  const [activeId, setActiveId] = useState<HomeBlockId | null>(null);

  const resolved = resolveHomeLayout(doc, HOME_LAYOUT_CATALOG);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const labelFor = (id: HomeBlockId) => t(HOME_BLOCK_REGISTRY[id].labelKey);
  const columnLabel = (column: "left" | "right") => t(`home.customize.columns.${column}`);

  function positionOf(id: HomeBlockId) {
    const inLeft = resolved.left.indexOf(id);
    if (inLeft !== -1) return { column: "left" as const, index: inLeft, total: resolved.left.length };
    const inRight = resolved.right.indexOf(id);
    return { column: "right" as const, index: inRight, total: resolved.right.length };
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as HomeBlockId);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeBlockId = active.id as HomeBlockId;
    const overId = String(over.id);

    const current = resolveHomeLayout(doc, HOME_LAYOUT_CATALOG);
    const activeColumn: "left" | "right" | null = current.left.includes(activeBlockId) ? "left" : current.right.includes(activeBlockId) ? "right" : null;
    if (!activeColumn) return;

    let toColumn: "left" | "right";
    let toIndex: number;
    if (overId === "left-column" || overId === "right-column") {
      toColumn = overId === "left-column" ? "left" : "right";
      toIndex = (toColumn === "left" ? current.left : current.right).length;
    } else {
      const overBlockId = overId as HomeBlockId;
      const overInLeft = current.left.includes(overBlockId);
      const overInRight = current.right.includes(overBlockId);
      if (!overInLeft && !overInRight) return;
      toColumn = overInLeft ? "left" : "right";
      toIndex = (toColumn === "left" ? current.left : current.right).indexOf(overBlockId);
    }

    const currentIndex = (activeColumn === "left" ? current.left : current.right).indexOf(activeBlockId);
    if (toColumn === activeColumn && toIndex === currentIndex) return;

    onChange(moveBlock(doc, { id: activeBlockId, toColumn, toIndex }, HOME_LAYOUT_CATALOG));
  }

  function handleDragEnd() {
    setActiveId(null);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleHide(id: HomeBlockId) {
    onChange(hideBlock(doc, id, HOME_LAYOUT_CATALOG));
  }

  function handleShow(id: HomeBlockId) {
    onChange(showBlock(doc, id, HOME_LAYOUT_CATALOG));
  }

  function handleMoveToOtherColumn(id: HomeBlockId, from: "left" | "right") {
    const to = from === "left" ? "right" : "left";
    const current = resolveHomeLayout(doc, HOME_LAYOUT_CATALOG);
    const toIndex = (to === "left" ? current.left : current.right).length;
    onChange(moveBlock(doc, { id, toColumn: to, toIndex }, HOME_LAYOUT_CATALOG));
  }

  function handleReset() {
    const before = doc;
    onChange(resetLayout());
    toast(t("home.customize.resetDone"), {
      action: { label: t("home.customize.undo"), onClick: () => onChange(before) },
    });
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("home.customize.a11y.pickUp", { block: labelFor(active.id as HomeBlockId) }),
    onDragOver: ({ active, over }) => {
      if (!over) return "";
      const { column, index, total } = positionOf(active.id as HomeBlockId);
      return t("home.customize.a11y.over", { block: labelFor(active.id as HomeBlockId), index: index + 1, total, column: columnLabel(column) });
    },
    onDragEnd: ({ active, over }) => {
      if (!over) return t("home.customize.a11y.cancelled", { block: labelFor(active.id as HomeBlockId) });
      const { column, index } = positionOf(active.id as HomeBlockId);
      return t("home.customize.a11y.dropped", { block: labelFor(active.id as HomeBlockId), index: index + 1, column: columnLabel(column) });
    },
    onDragCancel: ({ active }) => t("home.customize.a11y.cancelled", { block: labelFor(active.id as HomeBlockId) }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("home.customize.a11y.instructions") } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Solo `marginTop` de `style` (el espacio que dejan los banners) —
          su `gap: 28` es para la GRILLA de columnas de más abajo, no para
          este wrapper externo (hint + "Restablecer"), que sigue con su
          propio `gap: 12`. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: style?.marginTop }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>{t("home.customize.hint")}</span>
          <button
            type="button"
            onClick={handleReset}
            style={{ background: "none", border: 0, cursor: "pointer", padding: 0, color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, flexShrink: 0 }}
          >
            {t("home.customize.reset")}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 28 }}>
          <DroppableColumn id="left-column">
            <SortableContext items={resolved.left} strategy={verticalListSortingStrategy}>
              {resolved.left.map((id) => (
                <SortableBlock key={id} id={id} column="left" homeData={homeData} onHide={handleHide} onMoveToOtherColumn={handleMoveToOtherColumn} disableTransition={motionIntensity === "minimal"} />
              ))}
            </SortableContext>
          </DroppableColumn>

          <DroppableColumn id="right-column">
            <SortableContext items={resolved.right} strategy={verticalListSortingStrategy}>
              {resolved.right.map((id) => (
                <SortableBlock key={id} id={id} column="right" homeData={homeData} onHide={handleHide} onMoveToOtherColumn={handleMoveToOtherColumn} disableTransition={motionIntensity === "minimal"} />
              ))}
            </SortableContext>
          </DroppableColumn>

          <HiddenBlocksTray hiddenIds={resolved.hidden} onShow={handleShow} />
        </div>
      </div>

      <DragOverlay>{activeId ? <BlockPreview id={activeId} /> : null}</DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={COLUMN_STYLE}>
      {children}
    </div>
  );
}

function SortableBlock({
  id,
  column,
  homeData,
  onHide,
  onMoveToOtherColumn,
  disableTransition,
}: {
  id: HomeBlockId;
  column: "left" | "right";
  homeData: ReturnType<typeof useHomeData>;
  onHide: (id: HomeBlockId) => void;
  onMoveToOtherColumn: (id: HomeBlockId, from: "left" | "right") => void;
  disableTransition: boolean;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const def = HOME_BLOCK_REGISTRY[id];
  const label = t(def.labelKey);
  const available = def.isAvailable(homeData);
  const Component = def.Component;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: disableTransition ? undefined : transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DashboardBlockShell
        label={label}
        dragLabel={t("home.customize.dragBlock", { block: label })}
        hideLabel={t("home.customize.hideBlock", { block: label })}
        onHide={() => onHide(id)}
        moveToOtherColumnLabel={t(column === "left" ? "home.customize.moveToRightColumn" : "home.customize.moveToLeftColumn", { block: label })}
        onMoveToOtherColumn={() => onMoveToOtherColumn(id, column)}
        column={column}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragHandleRef={setActivatorNodeRef}
        unavailable={!available}
        unavailableLabel={t("home.customize.unavailable")}
      >
        <Component />
      </DashboardBlockShell>
    </div>
  );
}

/** Vista fantasma que sigue al puntero (`DragOverlay`) — solo el chrome, sin re-renderizar el bloque real dos veces. */
function BlockPreview({ id }: { id: HomeBlockId }) {
  const t = useTranslations();
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-2)",
        padding: "0 12px",
        height: 44,
        display: "flex",
        alignItems: "center",
        boxShadow: "var(--shadow-lift, 0 8px 24px rgba(0,0,0,.24))",
      }}
    >
      <span className="t-caption" style={{ color: "var(--text-secondary)" }}>{t(HOME_BLOCK_REGISTRY[id].labelKey)}</span>
    </div>
  );
}
