function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** H13/K10 — CSV genérico, RFC 4180 mínimo (comillas, comas y saltos de línea escapados). */
export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return lines.join("\r\n");
}
