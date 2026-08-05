import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noExcessPrimaryFill from "./eslint-rules/no-excess-primary-fill.mjs";

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
    // Mismo criterio para `docs/`: además de los documentos, ahí viven el
    // bundle del design system y la biblioteca de componentes de origen
    // (`docs/library/perze-v2.jsx`, `docs/design/*.js`) — código
    // versionado como REFERENCIA, que se porta a mano y no se mantiene.
    // Estaban dando 16 errores que no se iban a arreglar nunca, y eso
    // dejaba `pnpm lint` en rojo permanente: un comando que siempre falla
    // no avisa de nada, que es peor que no tenerlo.
    "docs/**",
    // Service worker compilado por Serwist — build output, no fuente.
    "public/sw.js",
  ]),
  {
    // Guardarraíl de i18n: ningún texto de UI hardcodeado en JSX — todo
    // pasa por next-intl (`useTranslations`/`getTranslations`), ver
    // CLAUDE.md § i18n. `/dev/*` es la referencia visual del design
    // system, en español a propósito (docs/01-arquitectura-datos.md) —
    // excluida junto con tests y e2e, que aseran contra copy fijo.
    // `src/emails/auth/**` son las plantillas de Auth de Supabase: van en
    // español fijo a propósito (el Dashboard tiene una sola plantilla por
    // tipo, sin noción de locale — ver `src/emails/auth/copy.ts`), así
    // que no aplica el guardarraíl de next-intl.
    ignores: ["src/app/dev/**", "e2e/**", "**/*.test.{ts,tsx}", "src/emails/auth/**"],
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
  {
    // CON-27: presupuesto de ruido — un solo `--primary-fill` visible por
    // pantalla. Solo aplica a archivos de pantalla, nunca a
    // `src/design-system/**`, donde el token es la implementación legítima
    // del componente (Switch, SegmentedControl/Chip de identidad, Button
    // primary, UndoToast) y no una segunda marca en la misma pantalla.
    files: ["src/app/**/page.tsx"],
    ignores: ["src/app/dev/**"],
    plugins: { "perze-tokens": { rules: { "no-excess-primary-fill": noExcessPrimaryFill } } },
    rules: {
      "perze-tokens/no-excess-primary-fill": "warn",
    },
  },
]);

export default eslintConfig;
