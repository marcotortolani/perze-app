export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex">
      {/* Desktop left panel — hidden on mobile */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklch, var(--app-accent) 90%, oklch(0.04 0.02 265)), color-mix(in oklch, var(--app-accent) 50%, oklch(0.06 0.025 265)))",
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "oklch(0.98 0 0)" }}
        />
        <div
          className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{ background: "oklch(0.3 0.3 200)" }}
        />
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center"
            style={{
              background: "oklch(0 0 0 / 20%)",
              backdropFilter: "blur(10px)",
              border: "1px solid oklch(1 0 0 / 25%)",
            }}
          >
            <svg
              viewBox="0 0 40 40"
              fill="none"
              className="w-10 h-10"
            >
              <path
                d="M8 30 L14 20 L20 24 L28 12 L34 16"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="34" cy="16" r="3" fill="white" />
            </svg>
          </div>

          <h1
            className="text-4xl font-black mb-4 tracking-tight"
            style={{ color: "oklch(0.98 0 0)" }}
          >
            Finanzas
          </h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: "oklch(0.98 0 0 / 75%)" }}
          >
            Controlá tus ingresos, gastos e inversiones en Argentina y Uruguay con soporte multi-moneda.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8 justify-center">
            {["Multi-moneda", "ARS & UYU", "IA Gemini", "PWA"].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  background: "oklch(0 0 0 / 20%)",
                  color: "oklch(0.98 0 0 / 85%)",
                  border: "1px solid oklch(1 0 0 / 20%)",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form area */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
        {/* Mobile background gradient */}
        <div
          className="md:hidden fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at -5% -5%, color-mix(in oklch, var(--app-accent) 18%, transparent), transparent)",
          }}
        />
        <div
          className="md:hidden fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 105% 105%, color-mix(in oklch, var(--app-accent) 10%, transparent), transparent)",
          }}
        />

        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
