/**
 * Download data as a CSV file.
 * @param rows  Array of objects — keys become headers, values become cells.
 * @param filename  File name without extension.
 */
export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Wrap in quotes if the value contains commas, quotes, or newlines
    return s.match(/[",\n\r]/) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv =
    headers.map(escape).join(",") +
    "\n" +
    rows.map((row) => headers.map((h) => escape(row[h])).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
