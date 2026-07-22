"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Event } from "@/lib/types";

interface RestockDialogProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Shared between Admin (Events & Markups) and Organizer (My Events) --
// reachable by Super Admin, Admin, or the event's own organizer, matching
// the ticket_types RLS policy exactly. Lets each ticket type's capacity be
// raised once it's sold out or running low.
export function RestockDialog({ event, open, onOpenChange, onSaved }: RestockDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!event) return null;

  const handleSave = async (ticketTypeId: string, currentQuantity: number) => {
    const raw = values[ticketTypeId];
    const quantity = raw === undefined ? currentQuantity : Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Enter a valid number.");
      return;
    }
    setSaving(ticketTypeId);
    setError(null);
    try {
      const res = await fetch(`/api/ticket-types/${ticketTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to update quantity.");
        return;
      }
      onSaved();
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Ticket Stock</DialogTitle>
          <DialogDescription>{event.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {event.ticketTypes.map((tt) => {
            const available = tt.quantity - tt.sold;
            return (
              <div key={tt.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{tt.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tt.sold} sold · {available <= 0 ? "sold out" : `${available} available`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label htmlFor={`qty-${tt.id}`} className="sr-only">Total quantity</Label>
                  <Input
                    id={`qty-${tt.id}`}
                    type="number"
                    min={tt.sold}
                    className="w-24"
                    defaultValue={tt.quantity}
                    onChange={(e) => setValues((v) => ({ ...v, [tt.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    disabled={saving === tt.id}
                    onClick={() => handleSave(tt.id, tt.quantity)}
                  >
                    {saving === tt.id ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            );
          })}
          {event.ticketTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">This event has no ticket types.</p>
          )}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
