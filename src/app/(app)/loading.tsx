import { HomeSkeleton } from "@/components/home-skeleton";

// Frame instantáneo de navegación (Fase 1, plan de fluidez) — se pinta
// antes de que `page.tsx` monte y sus queries resuelvan, no reemplaza el
// `isLoading` interno de la página (que sigue cubriendo revisitas sin
// remount).
export default function Loading() {
  return <HomeSkeleton />;
}
