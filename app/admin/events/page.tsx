"use client";

import { useState } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Tag, Percent } from "lucide-react";
import { mockEvents } from "@/lib/mock-data";
import { Event } from "@/lib/types";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [markupValue, setMarkupValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.organizerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSetMarkup = () => {
    if (editingEvent && markupValue) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? { ...e, platformMarkup: parseFloat(markupValue) }
            : e
        )
      );
      setDialogOpen(false);
      setEditingEvent(null);
      setMarkupValue("");
    }
  };

  const handleRemoveMarkup = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, platformMarkup: undefined } : e
      )
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Events & Markups</h1>
        <p className="text-muted-foreground mt-1">
          Manage events and add platform markups to ticket prices
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events or organizers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            All Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Tickets Sold</TableHead>
                <TableHead>Platform Markup</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell>{event.organizerName}</TableCell>
                  <TableCell className="capitalize">{event.category}</TableCell>
                  <TableCell>
                    {new Date(event.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {event.soldTickets} / {event.totalTickets}
                  </TableCell>
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
                      {event.platformMarkup && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveMarkup(event.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Markup Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Platform Markup</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="font-medium">{editingEvent?.title}</p>
              <p className="text-sm text-muted-foreground">
                {editingEvent?.organizerName}
              </p>
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
                Organizer still receives their full price, markup goes to platform.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetMarkup}>Save Markup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
