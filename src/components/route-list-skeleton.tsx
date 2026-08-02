import { Skeleton, SkeletonRow } from "@/design-system";

/**
 * Skeleton genérico de "encabezado + filas" — mismo patrón que ya usaban
 * `AccountsPage`/`AnalyticsPage` en su rama `isLoading`, ahora compartido
 * para poder usarlo también desde los `loading.tsx` de cada tab. No
 * reemplaza el skeleton específico del home (`HomeSkeleton`), que tiene una
 * composición propia (hero + cuentas + lista).
 */
export function RouteListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 16 }}>
      <Skeleton width={160} height={40} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
