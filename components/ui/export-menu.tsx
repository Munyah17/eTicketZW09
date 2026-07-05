"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

interface ExportMenuProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title?: string;
  disabled?: boolean;
}

// Drop-in "Export ▾" button — CSV / Excel / PDF — for any page with a data
// table. Pass the already-filtered rows and column accessors; the button
// takes care of the rest.
export function ExportMenu<T>({ rows, columns, filename, title, disabled }: ExportMenuProps<T>) {
  const [busy, setBusy] = useState(false);
  const isDisabled = disabled || busy || rows.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isDisabled}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToCSV(rows, columns, filename)} className="gap-2">
          <FileText className="h-4 w-4" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => { setBusy(true); try { await exportToExcel(rows, columns, filename); } finally { setBusy(false); } }}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => { setBusy(true); try { await exportToPDF(rows, columns, filename, title); } finally { setBusy(false); } }}
          className="gap-2"
        >
          <FileType className="h-4 w-4" />
          Export PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
