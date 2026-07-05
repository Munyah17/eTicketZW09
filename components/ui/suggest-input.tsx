"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SuggestInputProps<T> {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: T[];
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  renderSuggestion?: (item: T) => ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  icon?: ReactNode;
  maxResults?: number;
  onEnter?: () => void;
}

// A live-filtering "type and see up to N matches" input — no permanent
// always-open dropdown, the suggestion list only appears once there's
// something to suggest and closes on blur/escape/selection.
export function SuggestInput<T>({
  id,
  value,
  onChange,
  suggestions,
  getLabel,
  getKey,
  onSelect,
  renderSuggestion,
  placeholder,
  className,
  inputClassName,
  icon,
  maxResults = 10,
  onEnter,
}: SuggestInputProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = suggestions.slice(0, maxResults);

  useEffect(() => {
    setHighlighted(-1);
  }, [value, open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pick = (item: T) => {
    onSelect(item);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {icon}
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (results.length > 0) {
              setOpen(true);
              setHighlighted((h) => (h + 1) % results.length);
            }
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (results.length > 0) {
              setOpen(true);
              setHighlighted((h) => (h <= 0 ? results.length - 1 : h - 1));
            }
          } else if (e.key === "Enter") {
            if (open && highlighted >= 0 && results[highlighted]) {
              e.preventDefault();
              pick(results[highlighted]);
            } else {
              onEnter?.();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((item, i) => (
              <li key={getKey(item)}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(item);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    highlighted === i ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                  )}
                >
                  {renderSuggestion ? renderSuggestion(item) : getLabel(item)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
