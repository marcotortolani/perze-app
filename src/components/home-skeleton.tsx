"use client";

import type { ReactNode } from "react";
import { Skeleton, SkeletonRow } from "@/design-system";
import { useHomeLayoutMirrorStore } from "@/stores/home-layout-mirror-store";
import { resolveHomeLayout } from "@/features/home/layout/resolve-layout";
import { HOME_LAYOUT_CATALOG } from "@/features/home/blocks/registry";
import type { HomeBlockId } from "@/features/home/blocks/registry";

function HeroSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <Skeleton width={120} height={12} />
      <Skeleton width={180} height={44} />
      <Skeleton width={100} height={14} />
    </div>
  );
}

function BentoSkeleton() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <Skeleton width={208} height={92} radius={16} />
      <Skeleton width={208} height={92} radius={16} />
    </div>
  );
}

function RowsSkeleton({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <Skeleton width={90} height={11} />
        <Skeleton width={110} height={30} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <Skeleton width={90} height={11} />
        <Skeleton width={110} height={30} />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return <Skeleton width="100%" height={72} radius={16} />;
}

const BLOCK_SKELETON: Record<HomeBlockId, () => ReactNode> = {
  "net-worth": HeroSkeleton,
  investing: HeroSkeleton,
  accounts: BentoSkeleton,
  "credit-cards": () => <RowsSkeleton count={2} />,
  "period-totals": StatsSkeleton,
  insight: CardSkeleton,
  "recent-transactions": () => <RowsSkeleton count={4} />,
};

/**
 * Skeleton del home — extraído de `(app)/page.tsx` para poder reusarlo
 * también en `(app)/loading.tsx`: la navegación de un tab a otro necesita
 * un frame pintado ANTES de que el componente de la página monte y sus
 * queries resuelvan, no solo durante `isLoading` una vez montado.
 *
 * Lee el orden guardado directo del espejo local (`home-layout-mirror-store`,
 * sin red) — así el frame instantáneo ya refleja el layout que la persona
 * personalizó, en vez de mostrar siempre el orden default y saltar apenas
 * llegan los datos reales.
 */
export function HomeSkeleton() {
  const doc = useHomeLayoutMirrorStore((s) => s.doc);
  const resolved = resolveHomeLayout(doc, HOME_LAYOUT_CATALOG);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 28, paddingTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
        {resolved.left.map((id) => {
          const Shape = BLOCK_SKELETON[id];
          return <Shape key={id} />;
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
        {resolved.right.map((id) => {
          const Shape = BLOCK_SKELETON[id];
          return <Shape key={id} />;
        })}
      </div>
    </div>
  );
}
