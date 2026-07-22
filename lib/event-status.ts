import type { Event } from "@/lib/types";

export interface EventStatusTag {
  label: string;
  className: string;
}

// One ribbon per card, most-relevant-wins — an event can technically be
// both "ended" and "sold out", but showing one clear tag beats stacking
// several. Checked in priority order; "Active" is the fallback so every
// card always carries some tag rather than leaving ambiguous ones bare.
export function getEventStatusTag(event: Event): EventStatusTag {
  if (event.status === "cancelled") {
    return { label: "Cancelled", className: "bg-slate-700 text-white" };
  }

  const eventHasEnded = new Date(event.date).getTime() < Date.now() - 24 * 60 * 60 * 1000;
  if (eventHasEnded || event.status === "completed") {
    return { label: "Ended", className: "bg-slate-500 text-white" };
  }

  const total = event.totalTickets;
  const sold = event.soldTickets;
  if (total > 0 && sold >= total) {
    return { label: "Sold Out", className: "bg-destructive text-destructive-foreground" };
  }
  if (total > 0 && sold / total >= 0.85) {
    return { label: "Almost Sold Out", className: "bg-warning text-warning-foreground" };
  }
  if (total > 0 && sold >= 10 && sold / total >= 0.7) {
    return { label: "Hot Selling", className: "bg-gradient-to-r from-orange-500 to-red-500 text-white" };
  }

  return { label: "Active", className: "bg-success text-success-foreground" };
}
