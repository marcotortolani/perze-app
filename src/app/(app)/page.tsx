"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Banner, EmptyState, ErrorState, usePageHeader } from "@/design-system";
import { AnimatedBanner, PageEnter } from "@/components/motion";
import { HomeSkeleton } from "@/components/home-skeleton";
import { BirthdayBanner } from "@/components/birthday-banner";
import { ReminderBanner } from "@/components/reminder-banner";
import { HomeDataProvider, useHomeDataState } from "@/features/home/home-data";
import { HomeBlocksLayout } from "@/features/home/HomeBlocksLayout";

/** Home real — Bloque B, Fase 6: hero de patrimonio, cuentas, estado del mes, insight, últimos movimientos. */
export default function HomePage() {
  const router = useRouter();
  const t = useTranslations();
  const state = useHomeDataState();
  // `HomeBlocksLayout` (montado solo en el estado "ready") registra su
  // propio header con el botón "Personalizar" — como es un HIJO de este
  // componente, su efecto corre ANTES que el de acá (React dispara
  // layout effects de adentro hacia afuera), así que sin `enabled` este
  // `usePageHeader` de más abajo SIEMPRE pisaría el suyo en el mismo
  // commit y el botón nunca se vería. Acá solo registra mientras
  // `HomeBlocksLayout` no existe (loading/error/empty).
  usePageHeader({ title: t("nav.home") }, { enabled: state.status !== "ready" });

  if (state.status === "loading") return <HomeSkeleton />;
  if (state.status === "error") return <ErrorState {...state.error} />;
  if (state.status === "empty") return <EmptyState message={state.message} actionLabel={state.actionLabel} onAction={state.onAction} />;

  const { data } = state;
  const {
    scrollerRef,
    overflowing,
    showBirthdayBanner,
    birthdayAge,
    dismissBirthdayBanner,
    now,
    pending,
    conflicts,
    showReminderBanner,
    activeReminder,
    showRecurringDueBanner,
    dueManualRecurringCount,
    dueManualRecurringRuleId,
  } = data;

  return (
    // `PageEnter`: entrada suave del dashboard. Envuelve el retorno CON
    // DATOS, no los estados de carga de más arriba — así el gesto ocurre
    // cuando el contenido reemplaza al skeleton, en vez de animar el skeleton
    // y volver a animar cuando llegan los datos.
    <PageEnter>
    {/* `scroll-fade-bottom`: mismo tratamiento que `/accounts` — home maneja
        su propio scroll (sumada a `OWN_SCROLLER_ROUTES` en `(app)/layout.tsx`)
        para tener el mismo fade y aire real al final de "Movimientos recientes". */}
    <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", height: "100%", minHeight: 0 } as CSSProperties}>
      <div
        ref={scrollerRef}
        className="pb-[calc(var(--block-gap)_+_18px)] lg:pb-8 scroll-gutter-right"
        style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingTop: 8 }}
      >
      {/* `AnimatedBanner`: los 5 banners de acá abajo aparecían con su
          propia animación de montaje pero desaparecían de golpe (mismo
          patrón que `Overlay`/`Modal` tenían antes de arreglarse), con un
          salto de layout en todo lo de abajo. Ver el comentario del
          componente para el detalle. */}
      <AnimatedBanner show={showBirthdayBanner}>
        <BirthdayBanner age={birthdayAge} onDismiss={() => dismissBirthdayBanner(now.getFullYear())} />
      </AnimatedBanner>
      {/* `margin` asimétrico, no `0 calc(-1 * var(--screen-padding))` en
          los dos lados: este banner vive DENTRO del scroller
          `scroll-gutter-right` de más arriba, que estira su propia caja
          12px a la derecha y le agrega 20px de padding — el contenido
          normal (la lista de cuentas, etc.) termina con un inset de 20px
          a la izquierda pero 28px a la derecha (20 + 8 de aire real de la
          barra de scroll, ver el comentario de `scroll-gutter-right` en
          globals.css). Un `margin: 0 -20px` simétrico solo cancelaba el
          lado izquierdo — el derecho quedaba 8px corto y el banner se
          veía sangrado torcido. */}
      <AnimatedBanner show={!!pending && pending > 0}>
        <Banner status="offline" pending={pending} style={{ marginLeft: "calc(-1 * var(--screen-padding))", marginRight: "calc(-1 * var(--screen-padding) - 8px)", borderRadius: 0 }} />
      </AnimatedBanner>
      <AnimatedBanner show={conflicts.length > 0}>
        <Banner
          status="error"
          message={t("conflictsPage.homeBanner", { count: conflicts.length })}
          action={{ label: t("conflictsPage.homeBannerAction"), onClick: () => router.push("/more/sync") }}
          style={{ marginLeft: "calc(-1 * var(--screen-padding))", marginRight: "calc(-1 * var(--screen-padding) - 8px)", borderRadius: 0 }}
        />
      </AnimatedBanner>
      {/* Recurrentes manuales (auto_post=false) vencidos o que vencen hoy —
          mismo criterio de prioridad que los banners de arriba. Un tap va
          directo al detalle si hay una sola regla pendiente, o al listado
          de `/recurring` (agrupado en "Manuales") si hay más de una. */}
      <AnimatedBanner show={showRecurringDueBanner}>
        <Banner
          status="warning"
          message={t("recurringPage.dueHomeBanner", { count: dueManualRecurringCount })}
          action={{
            label: t("recurringPage.dueHomeBannerAction"),
            onClick: () => router.push(dueManualRecurringRuleId ? `/recurring/${dueManualRecurringRuleId}` : "/recurring"),
          }}
          style={{ marginLeft: "calc(-1 * var(--screen-padding))", marginRight: "calc(-1 * var(--screen-padding) - 8px)", borderRadius: 0 }}
        />
      </AnimatedBanner>
      {/* El recordatorio informativo solo aparece si no hay ya otro banner
          arriba — offline/conflicto/cumpleaños/recurrentes vencidos son más
          urgentes, y apilar avisos es exactamente el ruido que este banner
          intenta evitar. */}
      <AnimatedBanner show={showReminderBanner}>
        <ReminderBanner reminder={activeReminder} />
      </AnimatedBanner>

      <HomeDataProvider data={data}>
        <HomeBlocksLayout />
      </HomeDataProvider>
      </div>
    </div>
    </PageEnter>
  );
}
