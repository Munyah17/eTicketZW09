"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Tag, Percent, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Trash2, PackagePlus } from "lucide-react";
import type { Event } from "@/lib/types";
import { RestockDialog } from "@/components/events/restock-dialog";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [markupValue, setMarkupValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restockEvent, setRestockEvent] = useState<Event | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/events?${params}`);
      const data = await res.json();
      // Previously any failure (network error, non-OK response, bad JSON)
      // fell through to an empty list identical to "no events exist" — an
      // admin had no way to tell a real outage apart from a genuinely empty
      // platform.
      if (!res.ok) {
        setLoadError(data.error || `Failed to load events (${res.status})`);
        setEvents([]);
        return;
      }
      setEvents(data.events ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load events.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSetMarkup = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: editingEvent.id,
          platformMarkup: markupValue ? parseFloat(markupValue) : null,
        }),
      });
      setDialogOpen(false);
      setEditingEvent(null);
      setMarkupValue("");
      fetchEvents();
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMarkup = async (eventId: string) => {
    await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, platformMarkup: null }),
    });
    fetchEvents();
  };

  const handleModerate = async (eventId: string, status: "published" | "cancelled") => {
    await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status }),
    });
    fetchEvents();
  };

  const handleDelete = async (event: Event) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "Failed to delete event.");
        return;
      }
      setConfirmDelete(null);
      fetchEvents();
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status: Event["status"]) => {
    switch (status) {
      case "published":
        return <Badge className="bg-success text-success-foreground">Published</Badge>;
      case "pending_review":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending Review</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Events & Markups</h1>
        <p className="text-muted-foreground mt-1">
          Manage events and add platform markups to ticket prices
        </p>
      </div>

      <div className="flex gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events or organizers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            All Events {!loading && `(${events.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tickets Sold</TableHead>
                  <TableHead>Platform Markup</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-destructive">
                      {loadError} —{" "}
                      <button className="underline" onClick={fetchEvents}>retry</button>
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell>{event.organizerName}</TableCell>
                      <TableCell className="capitalize">{event.category}</TableCell>
                      <TableCell>{statusBadge(event.status)}</TableCell>
                      <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                      <TableCell>{event.soldTickets} / {event.totalTickets}</TableCell>
                      <TableCell>
                        {event.platformMarkup ? (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-sm">
                            <Percent className="h-3 w-3" />
                            {event.platformMarkup}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {event.status === "pending_review" && (
                            <>
                              <Button
                                size="sm"
                                className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                                onClick={() => handleModerate(event.id, "published")}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5"
                                onClick={() => handleModerate(event.id, "cancelled")}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingEvent(event);
                              setMarkupValue(event.platformMarkup?.toString() || "");
                              setDialogOpen(true);
                            }}
                          >
                            {event.platformMarkup ? "Edit" : "Add"} Markup
                          </Button>
                          {event.platformMarkup ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveMarkup(event.id)}
                            >
                              Remove
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            title="Restock tickets"
                            onClick={() => setRestockEvent(event)}
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            title="Delete listing"
                            onClick={() => setConfirmDelete(event)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Platform Markup</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="font-medium">{editingEvent?.title}</p>
              <p className="text-sm text-muted-foreground">{editingEvent?.organizerName}</p>
            </div>

            <div>
              <Label htmlFor="markup">Markup Percentage (%)</Label>
              <div className="relative mt-2">
                <Input
                  id="markup"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={markupValue}
                  onChange={(e) => setMarkupValue(e.target.value)}
                  placeholder="e.g. 5"
                  className="pr-10"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This markup will be added on top of all ticket prices for this event.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetMarkup} disabled={saving}>
              {saving ? "Saving…" : "Save Markup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Listing
            </DialogTitle>
            <DialogDescription>
              This cannot be undone. If this event has ever sold a ticket, the delete will be refused —
              use Cancel/Reject instead to preserve buyers&apos; records.
            </DialogDescription>
          </DialogHeader>
          {confirmDelete && (
            <div className="py-2">
              <p className="text-sm font-medium">{confirmDelete.title}</p>
              <p className="text-xs text-muted-foreground">{confirmDelete.organizerName}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              {deleting ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RestockDialog
        event={restockEvent}
        open={!!restockEvent}
        onOpenChange={(open) => !open && setRestockEvent(null)}
        onSaved={() => { fetchEvents(); }}
      />
    </div>
  );
}
