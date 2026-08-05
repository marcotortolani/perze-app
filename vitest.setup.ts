// Huso fijo para toda la suite. Sin esto, los tests de fecha corren en el huso
// de la máquina: en una CI en UTC, `new Date(y,m,d).toISOString()` y
// `"YYYY-MM-DDT00:00:00Z"` dan el MISMO string, así que los tests que existen
// para atrapar esa confusión pasan sin probar nada. UTC−3 sin horario de verano
// es además el huso real del producto (Uruguay/Argentina), o sea el caso que
// hay que proteger — ver `CLAUDE.md` § huso horario.
process.env.TZ = "America/Montevideo";

import "@testing-library/jest-dom/vitest";
