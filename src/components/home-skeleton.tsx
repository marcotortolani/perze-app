import { Skeleton, SkeletonRow } from "@/design-system";

/**
 * Skeleton del home — extraído de `(app)/page.tsx` para poder reusarlo
 * también en `(app)/loading.tsx`: la navegación de un tab a otro necesita
 * un frame pintado ANTES de que el componente de la página monte y sus
 * queries resuelvan, no solo durante `isLoading` una vez montado.
 */
export function HomeSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Skeleton width={120} height={12} />
        <Skeleton width={180} height={44} />
        <Skeleton width={100} height={14} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Skeleton width={208} height={92} radius={16} />
        <Skeleton width={208} height={92} radius={16} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
