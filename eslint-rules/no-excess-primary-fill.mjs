// CON-27 (docs/plan-de-trabajo.md § 7): el contrato de componentes pide una
// regla de lint que cuente usos de `--primary-fill` por archivo de pantalla
// y advierta sobre 1 — es el guardarraíl del "presupuesto de ruido": una
// pantalla con más de un violeta visible (fuera de gráficos) lo viola sin
// que nadie lo note en revisión de código.
//
// Esta regla solo se aplica a archivos de pantalla (`src/app/**`, vía
// `files` en `eslint.config.mjs`), nunca a `src/design-system/**`: ahí
// `--primary-fill` es una implementación legítima del propio componente
// (Switch encendido, SegmentedControl/Chip de identidad de dato,
// UndoToast, Button primary), no una segunda marca visible en la
// pantalla — esos usos están correctamente excluidos por no estar dentro
// del glob que activa la regla, no por una excepción textual acá.
//
// Mira el texto crudo del archivo: no resuelve JSX compuesto
// (`<Button variant="primary">` no contiene el token) — es deliberadamente
// literal, tal como lo pide el ítem del plan. Captura el caso real que
// motivó la regla: una pantalla que escribe `style={{ background:
// "var(--primary-fill)" }}` a mano, bypaseando los componentes, más de
// una vez.

const PRIMARY_FILL_TOKEN = "--primary-fill";

const noExcessPrimaryFill = {
  meta: {
    type: "problem",
    docs: {
      description: "Advierte cuando un archivo de pantalla referencia --primary-fill más de una vez (presupuesto de ruido, docs/contrato-componentes.md § 0).",
    },
    schema: [],
    messages: {
      tooMany:
        "Este archivo referencia --primary-fill {{count}} veces. El presupuesto de ruido admite un solo violeta visible por pantalla (fuera de gráficos) — mové el resto a otra pantalla, o consumí el token vía un componente del design system en vez de un estilo inline repetido.",
    },
  },
  create(context) {
    return {
      "Program:exit"(node) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const text = sourceCode.getText();
        const matches = text.split(PRIMARY_FILL_TOKEN).length - 1;
        if (matches > 1) {
          context.report({ node, messageId: "tooMany", data: { count: String(matches) } });
        }
      },
    };
  },
};

export default noExcessPrimaryFill;
