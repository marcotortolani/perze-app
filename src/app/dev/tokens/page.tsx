import { notFound } from "next/navigation";

/**
 * Referencia visual viva de los tokens del design system — solo en
 * desarrollo. Compara acá antes de tocar `globals.css` a mano.
 * Ver `docs/02-design-system.md` § 2-4 y
 * `perze-design/PERZE-Design-System/tokens/`.
 */
export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ padding: 32, display: "flex", flexDirection: "column", gap: 40 }}>
      <h1 className="t-title">Tokens — PERZE</h1>

      <Section title="Neutros">
        <Row>
          <Swatch varName="--page" label="page" />
          <Swatch varName="--surface-1" label="surface-1" />
          <Swatch varName="--surface-2" label="surface-2" />
          <Swatch varName="--surface-3" label="surface-3" />
          <Swatch varName="--border" label="border" />
        </Row>
        <Row>
          <TextSwatch varName="--text-primary" label="text-primary" />
          <TextSwatch varName="--text-secondary" label="text-secondary" />
          <TextSwatch varName="--text-muted" label="text-muted" />
        </Row>
      </Section>

      <Section title="Marca y polaridad">
        <Row>
          <Swatch varName="--primary-fill" label="primary-fill" />
          <TextSwatch varName="--primary-ink" label="primary-ink" />
          <Swatch varName="--secondary" label="secondary (aqua)" />
          <Swatch varName="--accent" label="accent (naranja)" />
        </Row>
      </Section>

      <Section title="Estado (fijo, nunca tematizado)">
        <Row>
          <Swatch varName="--good" label="good" />
          <Swatch varName="--warning" label="warning" />
          <Swatch varName="--serious" label="serious" />
          <Swatch varName="--critical" label="critical" />
        </Row>
      </Section>

      <Section title="Datos — 5 slots fijos + Otros">
        <Row>
          <Swatch varName="--data-1" label="1 violeta" />
          <Swatch varName="--data-2" label="2 aqua" />
          <Swatch varName="--data-3" label="3 naranja" />
          <Swatch varName="--data-4" label="4 azul" />
          <Swatch varName="--data-5" label="5 magenta" />
          <Swatch varName="--data-other" label="otros" />
        </Row>
      </Section>

      <Section title="Rampa secuencial (violeta)">
        <Row>
          {[
            "100", "150", "200", "250", "300", "350", "400", "450", "500",
            "550", "600", "650", "700",
          ].map((step) => (
            <Swatch key={step} varName={`--violet-${step}`} label={step} small />
          ))}
        </Row>
      </Section>

      <Section title="Tipografía — máximo 3 niveles coexistiendo">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="t-hero-xl">Hero XL 64/60</p>
          <p className="t-hero">Hero 40/44</p>
          <p className="t-title">Title 22/28</p>
          <p className="t-body">Body 16/24 — el peso por defecto de la interfaz.</p>
          <p className="t-label">Label 13/18</p>
          <p className="t-caption">Caption 11/16, uppercase</p>
          <p className="tabular" style={{ fontSize: 16 }}>
            123.456,78 — tabular-nums, Geist Mono
          </p>
        </div>
      </Section>

      <Section title="Radios">
        <Row>
          {(
            [
              ["input", 14],
              ["button", 16],
              ["card", 20],
              ["keypad-key", 20],
              ["chip", 999],
            ] as const
          ).map(([name, px]) => (
            <div key={name} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: "var(--surface-2)",
                  borderRadius: `var(--radius-${name})`,
                }}
              />
              <span className="t-caption" style={{ color: "var(--text-muted)" }}>
                {name} · {px}
              </span>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Motion — duraciones (ver src/lib/motion/springs.ts)">
        <Row>
          {(["micro", "fast", "base", "slow"] as const).map((name) => (
            <DurationBar key={name} varName={`--duration-${name}`} label={name} />
          ))}
        </Row>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="t-label" style={{ color: "var(--text-secondary)", textTransform: "uppercase" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>{children}</div>;
}

function Swatch({
  varName,
  label,
  small = false,
}: {
  varName: string;
  label: string;
  small?: boolean;
}) {
  const size = small ? 40 : 64;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <div
        style={{
          width: size,
          height: size,
          background: `var(${varName})`,
          borderRadius: "var(--radius-input)",
          border: "1px solid var(--border)",
        }}
      />
      <span className="t-caption" style={{ color: "var(--text-muted)", textAlign: "center" }}>
        {label}
      </span>
    </div>
  );
}

function TextSwatch({ varName, label }: { varName: string; label: string }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "var(--surface-1)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <span className="t-body" style={{ color: `var(${varName})` }}>
        {label}
      </span>
    </div>
  );
}

function DurationBar({ varName, label }: { varName: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <div
        style={{
          width: 8,
          height: 48,
          background: "var(--primary-fill)",
          borderRadius: "var(--radius-chip)",
          animation: `dev-tokens-pulse var(${varName}) ease-in-out infinite alternate`,
        }}
      />
      <span className="t-caption" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <style>{`@keyframes dev-tokens-pulse { from { opacity: .3 } to { opacity: 1 } }`}</style>
    </div>
  );
}
