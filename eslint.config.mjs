import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // MVP anterior, archivado como referencia histórica — no se mantiene.
    // Ver docs/perze-plan-redesign-first-5-blocks.md.
    "src/app-old/**",
    // Paquete de diseño de origen (wireframes, alta fidelidad, design
    // system a portar) — no es código de la app, ver README.md.
    "perze-design/**",
    // Service worker compilado por Serwist — build output, no fuente.
    "public/sw.js",
  ]),
  {
    // Guardarraíl de i18n: ningún texto de UI hardcodeado en JSX — todo
    // pasa por next-intl (`useTranslations`/`getTranslations`), ver
    // CLAUDE.md § i18n. `/dev/*` es la referencia visual del design
    // system, en español a propósito (docs/01-arquitectura-datos.md) —
    // excluida junto con tests y e2e, que aseran contra copy fijo.
    ignores: ["src/app/dev/**", "e2e/**", "**/*.test.{ts,tsx}"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          // Solo texto hijo de JSX (`<span>Hola</span>`) — los props
          // (aria-label, placeholder) ya no tienen default hardcodeado
          // desde la migración a next-intl (ver Fase 1 del plan de i18n)
          // y no vale la pena chequearlos acá.
          noAttributeStrings: false,
          // Símbolos/puntuación que aparecen sueltos en JSX y no son
          // texto traducible.
          allowedStrings: ["·", "→", "↑", "↓", "−", "%", "—", "…", "+", "×", "÷", "•", "✓", "PERZE"],
        },
      ],
    },
  },
]);

export default eslintConfig;
