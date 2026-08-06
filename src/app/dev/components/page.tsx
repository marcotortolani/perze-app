"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import {
  AccountCarousel,
  AccountRow,
  Amount,
  AmountScrubber,
  AppHeader,
  Banner,
  BudgetRing,
  Button,
  Card,
  CategoryBubble,
  Chip,
  CurrencyChip,
  DateStrip,
  DismissibleNotice,
  EmptyState,
  ErrorState,
  FxEditor,
  GroupCard,
  InsightCard,
  InstitutionTile,
  Input,
  Keypad,
  ListRow,
  OptionCard,
  OtpInput,
  PinKeypad,
  PrivacyBlur,
  ProgressBar,
  ProgressSteps,
  RateRow,
  ResolutionChain,
  SectionGroup,
  SegmentedControl,
  Sheet,
  Skeleton,
  SkeletonRow,
  SplitBar,
  StatTile,
  StatusBadge,
  Switch,
  SyncDot,
  TabBar,
  TransactionRow,
  UndoToast,
} from "@/design-system";
import { BarChart, LineChart, SeriesLegend, Sparkline } from "@/design-system/charts";
import { ContextualTooltip, LockScreen } from "@/design-system/systems";
import { CountUp, DetailPanelTransition, MorphButton, PageEnter, Pressable, StaggerList } from "@/components/motion";
import { SwipeableRow } from "@/features/movements/SwipeableRow";
import { money } from "@/lib/money/money";
import { rateFromInteger } from "@/lib/fx/rate";

/** Registros de mentira para demostrar `DetailPanelTransition` — lo único que
 *  importa es que la `transitionKey` cambie. */
const DETAIL_PANEL_DEMO = ["Itaú · Caja de ahorro", "BBVA · Caja de ahorro", "Visa BBVA · Tarjeta"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32, borderBottom: "1px solid var(--border)" }}>
      <h2 className="t-title">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>{children}</div>;
}

const DEMO_MONEY = money(125_000n, "UYU");

// Mismos tres pasos por eje que `BACKDROP_DENSITIES`/`BACKDROP_INTENSITIES`
// (`src/lib/backdrop/constants.ts`) y los mismos valores que sus overrides
// en `globals.css` — acá hardcodeados para no depender del toggle global
// `data-backdrop` al calibrar.
const BACKDROP_DENSITY_DEMOS = [
  { key: "loose", gap: "24px", label: "Amplia" },
  { key: "normal", gap: "16px", label: "Normal" },
  { key: "tight", gap: "12px", label: "Compacta" },
] as const;
const BACKDROP_INTENSITY_DEMOS = [
  { key: "subtle", mix: "35%", label: "Sutil" },
  { key: "normal", mix: "55%", label: "Normal" },
  { key: "strong", mix: "80%", label: "Marcada" },
  { key: "vivid", mix: "100%", label: "Intensa" },
] as const;

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Disparadores de `not-found.tsx`/`error.tsx` — los dos tienen que
  // lanzar durante el render (un boundary de error de React nunca
  // atrapa un throw dentro de un `onClick`), así que el botón solo pone
  // el estado y el throw/`notFound()` pasa acá abajo, antes del JSX.
  const [force404, setForce404] = useState(false);
  const [forceError, setForceError] = useState(false);
  if (force404) notFound();
  if (forceError) throw new Error("Error forzado desde /dev/components — para ver error.tsx");

  const [segValue, setSegValue] = useState("expense");
  const [scopeValue, setScopeValue] = useState("Personal");
  const [switchOn, setSwitchOn] = useState(true);
  const [chipSelected, setChipSelected] = useState(false);
  const [categorySelected, setCategorySelected] = useState("cart");
  const [dateValue, setDateValue] = useState("2026-07-27");
  const [keypadBuffer, setKeypadBuffer] = useState("1.250");
  const [pin, setPin] = useState("12");
  const [countUpValue, setCountUpValue] = useState(125_000n);
  const [detailPanelIndex, setDetailPanelIndex] = useState(0);
  const [pageEnterRun, setPageEnterRun] = useState(0);
  const [privacy, setPrivacy] = useState(false);
  const [otp, setOtp] = useState("123");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(true);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [scrubValue, setScrubValue] = useState(money(125_000n, "UYU"));
  const [fxRate, setFxRate] = useState(rateFromInteger(40));
  const [split, setSplit] = useState([
    { label: "Vos", value: 60 },
    { label: "Ana", value: 40 },
  ]);

  return (
    <main style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32, maxWidth: 900 }}>
      <h1 className="t-hero">Componentes — PERZE</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)" }}>
        Referencia viva del design system portado. Comparar contra los <code>.dc.html</code> de cada bloque en{" "}
        <code>perze-design/</code>.
      </p>

      <Section title="Core">
        <Row>
          <Button onClick={() => {}}>Primario</Button>
          <Button variant="secondary" fullWidth={false}>
            Secundario
          </Button>
          <Button variant="ghost" fullWidth={false}>
            Ghost
          </Button>
          <Button variant="danger" fullWidth={false} icon="trash">
            Danger
          </Button>
        </Row>
        <Row>
          <Card style={{ width: 160 }}>Card superficie 1</Card>
          <Card surface={2} style={{ width: 160 }}>
            Card superficie 2
          </Card>
        </Row>
        <Row>
          <Chip selected={chipSelected} onClick={() => setChipSelected((v) => !v)}>
            Filtro
          </Chip>
          <Chip icon="coffee">Café</Chip>
        </Row>
        <Row>
          <StatusBadge status="neutral">Sin sincronizar</StatusBadge>
          <StatusBadge status="warning">80% del presupuesto</StatusBadge>
          <StatusBadge status="serious">Aumentó de precio</StatusBadge>
          <StatusBadge status="critical">Presupuesto excedido</StatusBadge>
        </Row>
        <Row>
          <Switch checked={switchOn} onChange={setSwitchOn} label="Notificaciones" id="sw-1" />
        </Row>
        <Row>
          <SegmentedControl options={["expense", "income", "transfer"]} value={segValue} onChange={setSegValue} />
          <SegmentedControl options={["Personal", "Compartido", "Todo"]} value={scopeValue} onChange={setScopeValue} emphasis="brand" size="sm" />
        </Row>
        <ListRow label="Preferencias" meta="Moneda, idioma, tema" icon="target" onClick={() => {}} />
        <ListRow label="Notificaciones" variant="value" right={<Switch checked={switchOn} onChange={setSwitchOn} id="sw-2" />} chevron={false} />
        <Row>
          <ProgressSteps current={2} total={5} onSkip={() => {}} skipLabel="Saltear" />
        </Row>
        <Row>
          <OtpInput value={otp} onChange={setOtp} />
        </Row>
        <Row>
          <Input label="Nombre" placeholder="Tu nombre" style={{ width: 200 }} />
          <Input label="Email" value="vos@ejemplo.com" readOnly style={{ width: 200 }} />
          <Input label="Contraseña" type="password" placeholder="••••••••" revealable style={{ width: 200 }} />
        </Row>
        <SectionGroup label="Cuentas" count={2} onSeeAll={() => {}} seeAllLabel="Ver todos">
          <ListRow label="Itaú Caja de Ahorro" meta="UYU" icon="wallet" />
        </SectionGroup>
        {noticeOpen ? (
          <DismissibleNotice
            message="Podés poner Inversiones en la barra desde Ajustes."
            onDismiss={() => setNoticeOpen(false)}
            dismissLabel="Descartar"
          />
        ) : null}
        <Row>
          <Button variant="secondary" fullWidth={false} onClick={() => setSheetOpen(true)}>
            Abrir Sheet
          </Button>
        </Row>
      </Section>

      <Section title="Money">
        <Row>
          <Amount value={DEMO_MONEY} size="hero" />
          <Amount value={money(-45_000n, "USD")} size="title" />
          <Amount value={DEMO_MONEY} size="body" showSign={false} polarity="neutral" />
        </Row>
        <Row>
          <PrivacyBlur active={privacy}>
            <Amount value={DEMO_MONEY} size="title" />
          </PrivacyBlur>
          <Button variant="secondary" fullWidth={false} icon={privacy ? "eye" : "eye-off"} onClick={() => setPrivacy((v) => !v)}>
            {privacy ? "Mostrar" : "Ocultar"}
          </Button>
        </Row>
        <Row>
          <CurrencyChip currency="UYU" selected />
          <CurrencyChip currency="USD" />
        </Row>
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            Keypad
          </p>
          <Amount value={money(BigInt(keypadBuffer.replace(/\D/g, "") || "0"), "UYU")} size="hero-xl" mutedDecimals />
          <div style={{ maxWidth: 320, marginTop: 12 }}>
            <Keypad
              onKey={(k) => setKeypadBuffer((b) => (k === "backspace" ? b.slice(0, -1) : b + k))}
              onClear={() => setKeypadBuffer("")}
            />
          </div>
        </div>
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            AmountScrubber (arrastrar)
          </p>
          <AmountScrubber value={scrubValue} onChange={(n) => setScrubValue(money(n, "UYU"))} />
        </div>
        <div style={{ maxWidth: 320 }}>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            FxEditor
          </p>
          <FxEditor from="USD" to="UYU" rate={fxRate} suggested={rateFromInteger(40)} onChange={setFxRate} stale ageHours={26} />
        </div>
        <div style={{ maxWidth: 220 }}>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            PinKeypad
          </p>
          <PinKeypad length={pin.length} onKey={(k) => setPin((p) => (k === "backspace" ? p.slice(0, -1) : (p + k).slice(0, 6)))} />
        </div>
      </Section>

      <Section title="Finance">
        <AccountCarousel
          accounts={[
            { id: "1", institution: "Itaú", name: "Caja de Ahorro", balance: money(2_500_000n, "UYU"), country: "UY" },
            { id: "2", institution: "Brou", name: "Débito", balance: money(1_200_000n, "UYU"), country: "UY" },
          ]}
          activeId="1"
        />
        <Row>
          <BudgetRing progress={0.65} label="Supermercado" sublabel="$ 6.500 de $ 10.000" />
          <BudgetRing progress={1.15} label="Restaurantes" sublabel="sobregiro" />
        </Row>
        <Row>
          <CategoryBubble icon="cart" label="Súper" selected={categorySelected === "cart"} onClick={() => setCategorySelected("cart")} />
          <CategoryBubble icon="coffee" label="Café" selected={categorySelected === "coffee"} onClick={() => setCategorySelected("coffee")} />
          <CategoryBubble icon="car" label="Auto" selected={categorySelected === "car"} onClick={() => setCategorySelected("car")} />
        </Row>
        <DateStrip
          days={[
            { date: "2026-07-26", label: "Ayer" },
            { date: "2026-07-27", label: "Hoy" },
            "2026-07-28",
          ]}
          value={dateValue}
          onChange={setDateValue}
        />
        <InsightCard
          status="serious"
          text="Gastaste 34% más en Restaurantes que tu promedio de 6 meses."
          actionLabel="Ver detalle"
          onAction={() => {}}
          onDismiss={() => {}}
          dismissLabel="Descartar"
        />
        <Row>
          <OptionCard title="Solo" description="Vas a usar la app para vos." selected onClick={() => {}} />
          <OptionCard title="Con mi pareja" description="Comparten cuentas y gastos." onClick={() => {}} />
        </Row>
        <Row>
          <InstitutionTile name="Itaú" color="#EC7000" selected onClick={() => {}} />
          <InstitutionTile name="Mercado Pago" color="#009EE3" onClick={() => {}} />
        </Row>
        <AccountRow name="Itaú Caja de Ahorro" meta="UYU" balance={DEMO_MONEY} icon="wallet" />
        <RateRow pair="USD → UYU" source="DolarApi · oficial" ageLabel="hace 2 h" rate={fxRate} />
        <ResolutionChain steps={[{ label: "Movimiento 1" }, { label: "Movimiento 2" }, { label: "Movimiento 3" }]} activeIndex={1} />
        <GroupCard
          caption="Sin tipo de cambio"
          summary="3 movimientos en ARS esperando cotización"
          figure={<Amount value={money(350_000n, "ARS")} size="title" showSign={false} />}
          actionLabel="Resolver ahora"
          onAction={() => {}}
        />
        <div style={{ maxWidth: 260 }}>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            ProgressBar (consumo de tarjeta)
          </p>
          <ProgressBar value={0.72} />
        </div>
        <Row>
          <StatTile label="Tasa de ahorro" value="24%" delta="↑ 4,2%" deltaPolarity="positive" deltaNote="vs. junio" />
        </Row>
        <TransactionRow icon="cart" merchant="Tienda Inglesa" meta="Itaú Caja de Ahorro · Supermercado" value={money(-428_000n, "UYU")} onClick={() => {}} />
        <div style={{ maxWidth: 400 }}>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            SwipeableRow — deslizar a la izquierda pasa a confirmación destructiva; a la derecha, edita directo
          </p>
          <SwipeableRow onSwipeLeftCommit={() => {}} onSwipeRightCommit={() => {}} confirmLabel="¿Borrar movimiento?" confirmActionLabel="Borrar">
            <TransactionRow icon="cart" merchant="Tienda Inglesa" meta="Itaú Caja de Ahorro · Supermercado" value={money(-428_000n, "UYU")} onClick={() => {}} />
          </SwipeableRow>
        </div>
        <div style={{ maxWidth: 320 }}>
          <p className="t-label" style={{ color: "var(--text-secondary)" }}>
            SplitBar
          </p>
          <SplitBar parts={split} onChange={setSplit} />
        </div>
      </Section>

      <Section title="Navegación">
        <AppHeader title="Ajustes" onBack={() => {}} backLabel="Volver" />
        <AppHeader
          scope={scopeValue}
          onScopeChange={setScopeValue}
          scopeOptions={["Personal", "Compartido", "Todo"]}
          syncState="offline"
          pending={3}
          onSearch={() => {}}
          searchLabel="Buscar"
        />
        <TabBar active="home" onChange={() => {}} />
        <Row>
          <SyncDot state="synced" />
          <SyncDot state="syncing" />
          <SyncDot state="offline" pending={3} />
        </Row>
      </Section>

      <Section title="Feedback">
        <EmptyState message="Todavía no cargaste gastos." actionLabel="Cargar el primero" onAction={() => {}} />
        <ErrorState
          what="No pudimos sincronizar con Itaú."
          next="Tus gastos locales están guardados."
          onAlternative={() => {}}
          alternativeLabel="Ver offline"
          onRetry={() => {}}
          retryLabel="Reintentar"
        />
        <Banner status="offline" pending={3} />
        <Banner status="warning" />
        <Banner status="error" />
        <UndoToast message="Sincronizando…" variant="progress" visible />
        <SkeletonRow />
        <Skeleton width={120} height={20} />
        <Row>
          <Button variant="secondary" fullWidth={false} onClick={() => setSheetOpen(true)}>
            Ver Sheet
          </Button>
        </Row>
        <UndoToast message="Movimiento borrado" onUndo={() => {}} visible />
      </Section>

      <Section title="Páginas de error (dev)">
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
          Dispara el boundary real de Next para esta ruta — sirve para ver{" "}
          <code>{`(app)/error.tsx`}</code> y <code>{`(app)/not-found.tsx`}</code> (o los de la
          raíz, si entrás a esta pantalla sin sesión) tal como se van a ver en producción.
        </p>
        <Row>
          <Button variant="secondary" fullWidth={false} onClick={() => setForce404(true)}>
            Forzar 404
          </Button>
          <Button variant="secondary" fullWidth={false} onClick={() => setForceError(true)}>
            Forzar error
          </Button>
        </Row>
      </Section>

      <Section title="Charts">
        <BarChart
          data={[
            { label: "Abr", value: 53 },
            { label: "May", value: 34 },
            { label: "Jun", value: 59, display: "$ 59.000" },
            { label: "Jul", value: 45 },
          ]}
        />
        <LineChart
          data={[
            { label: "Lun", value: 100 },
            { label: "Mar", value: 120 },
            { label: "Mié", value: 90 },
            { label: "Jue", value: 140 },
          ]}
          formatValue={(v) => `$ ${v}`}
        />
        <Sparkline values={[10, 14, 9, 18, 22, 19, 25]} />
        <SeriesLegend series={[{ label: "Supermercado", value: "42%" }, { label: "Restaurantes", value: "28%" }]} />
      </Section>

      <Section title="Fondo de puntos (opt-in — Ajustes)">
        <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
          Los 12 combos de densidad × intensidad que el usuario puede elegir en Ajustes. Cada
          celda replica la fórmula de <code>page-backdrop</code> (`globals.css`) de forma
          aislada, para calibrar sin depender del toggle global.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {BACKDROP_DENSITY_DEMOS.map((density) =>
            BACKDROP_INTENSITY_DEMOS.map((intensity) => (
              <div key={`${density.key}-${intensity.key}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  style={{
                    position: "relative",
                    height: 100,
                    borderRadius: "var(--radius-card)",
                    overflow: "hidden",
                    background: "var(--surface-1)",
                    backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--border) ${intensity.mix}, transparent) 1px, transparent 1px)`,
                    backgroundSize: `${density.gap} ${density.gap}`,
                    WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 45%, #000 35%, transparent 100%)",
                    maskImage: "radial-gradient(ellipse 90% 70% at 50% 45%, #000 35%, transparent 100%)",
                  }}
                />
                <span className="t-caption" style={{ color: "var(--text-muted)" }}>
                  {density.label} · {intensity.label}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Sistemas (Bloque L)">
        <div style={{ position: "relative", height: 200, background: "var(--surface-1)", borderRadius: "var(--radius-card)" }}>
          <LockScreen onSubmit={() => true} onBiometric={() => {}} style={{ minHeight: 200, padding: 24 }} />
        </div>
        {tooltipOpen ? (
          <ContextualTooltip message="Activá el modo privacidad para difuminar los montos en público." onDismiss={() => setTooltipOpen(false)}>
            <Button variant="secondary" fullWidth={false}>
              Modo privacidad
            </Button>
          </ContextualTooltip>
        ) : null}
      </Section>

      <Section title="Motion">
        <Row>
          <Pressable onClick={() => setCountUpValue((v) => v + 50_000n)} style={{ padding: "12px 20px", background: "var(--surface-2)", borderRadius: 16 }}>
            Sumar $500 (Pressable)
          </Pressable>
        </Row>
        <CountUp value={countUpValue} currency="UYU" size="hero" />
        <StaggerList
          items={["Supermercado", "Restaurantes", "Transporte", "Vivienda"]}
          getKey={(item) => item}
          renderItem={(item) => <ListRow label={item} icon="cart" />}
        />
        <div style={{ maxWidth: 260 }}>
          <MorphButton onConfirm={() => new Promise((r) => setTimeout(r, 50))}>Guardar</MorphButton>
        </div>
        {/* `DetailPanelTransition` — la transición del panel de detalle en un
            master-detail de escritorio (`/transactions`, `/accounts`). Acá se
            demuestra con un botón que cambia la `transitionKey`, que es lo
            único que dispara la animación: en las pantallas reales ese valor
            es el id del registro seleccionado. */}
        <Row>
          <Button variant="secondary" fullWidth={false} onClick={() => setDetailPanelIndex((i) => (i + 1) % DETAIL_PANEL_DEMO.length)}>
            Siguiente detalle
          </Button>
        </Row>
        <div style={{ maxWidth: 320, background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16 }}>
          <DetailPanelTransition transitionKey={DETAIL_PANEL_DEMO[detailPanelIndex]!}>
            <ListRow label={DETAIL_PANEL_DEMO[detailPanelIndex]!} icon="wallet" variant="value" meta="Detalle" />
          </DetailPanelTransition>
        </div>
        {/* `PageEnter` — entrada de pantalla. A diferencia de
            `DetailPanelTransition`, anima al MONTARSE: acá se remonta con una
            `key` que cambia, que es la única forma de volver a verlo sin
            recargar. En una pantalla real no lleva key: ocurre una vez. */}
        <Row>
          <Button variant="secondary" fullWidth={false} onClick={() => setPageEnterRun((n) => n + 1)}>
            Repetir entrada de pantalla
          </Button>
        </Row>
        <div style={{ maxWidth: 320, background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16 }}>
          <PageEnter key={pageEnterRun} style={{}}>
            <ListRow label="Contenido de la pantalla" icon="chart" variant="value" meta="PageEnter" />
          </PageEnter>
        </div>
      </Section>

      <Sheet open={sheetOpen} title="Filtros" onClose={() => setSheetOpen(false)} height={280}>
        <p className="t-body">Contenido del sheet.</p>
      </Sheet>
    </main>
  );
}
