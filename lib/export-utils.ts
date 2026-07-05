// Shared CSV/Excel/PDF export used by every admin/organizer data-table page —
// one implementation so formatting stays consistent and each page just
// supplies its own column definitions and (already filtered) rows.

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

function toCells<T>(rows: T[], columns: ExportColumn<T>[]): string[][] {
  return rows.map((row) => columns.map((c) => String(c.accessor(row) ?? "")));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const cells = toCells(rows, columns);
  const csv = [columns.map((c) => c.header), ...cells]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv" }), `${filename}.csv`);
}

export async function exportToExcel<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const XLSX = await import("xlsx");
  const data = [columns.map((c) => c.header), ...toCells(rows, columns)];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Export");
  XLSX.writeFile(book, `${filename}.xlsx`);
}

export async function exportToPDF<T>(rows: T[], columns: ExportColumn<T>[], filename: string, title?: string) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  if (title) {
    doc.setFontSize(14);
    doc.text(title, 14, 15);
  }
  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: toCells(rows, columns),
    startY: title ? 20 : 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${filename}.pdf`);
}
