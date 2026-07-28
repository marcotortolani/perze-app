import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default a "node": la mayoría de lib/* es lógica pura sin DOM. Los
    // componentes que sí lo necesitan lo piden por archivo con
    // `// @vitest-environment happy-dom` (más liviano que jsdom y sin sus
    // problemas de interop ESM/CJS con paquetes recientes).
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
