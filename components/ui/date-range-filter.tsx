"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

// Lets an operator scope an export (or a list view) to a date range —
// reused everywhere data can be exported so the pattern is identical
// across admin/organizer pages.
export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const hasRange = Boolean(from || to);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="w-[150px]"
        aria-label="From date"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="w-[150px]"
        aria-label="To date"
      />
      {hasRange && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { onFromChange(""); onToChange(""); }}
          title="Clear date range"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Shared predicate — true if `dateStr` (any parseable date) falls within
// [from, to] (inclusive), treating an empty from/to as unbounded on that side.
export function inDateRange(dateStr: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 86_400_000 - 1) return false;
  return true;
}
