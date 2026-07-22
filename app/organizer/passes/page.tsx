"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { BadgeCheck, Plus, Download, Trash2, RefreshCw, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrganizerEvents } from "@/lib/events-store";
import { Event } from "@/lib/types";

interface ServiceProviderPass {
  id: string;
  full_name: string;
  photo_url: string;
  company_name: string;
  position: string;
  revoked: boolean;
  created_at: string;
}

// Common event-crew positions — a starting point, not a restriction. The
// field stays free-text since the real list is effectively endless (per
// the brief: usher, security, DJ, sound engineer, umpire, choreographer...).
const COMMON_POSITIONS = [
  "Usher", "Security", "Bouncer", "Sound Engineer", "DJ", "Videographer",
  "Cameraman", "Photographer", "Choreographer", "MC", "Stage Manager",
  "Event Admin", "Caterer", "First Aid",
];

export default function ServicePassesPage() {
  const { user, isSuperAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [passes, setPasses] = useState<ServiceProviderPass[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [position, setPosition] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin) {
      fetch("/api/admin/events")
        .then((res) => res.json())
        .then((data) => setEvents((data.events ?? []).filter((e: Event) => e.status === "published")))
        .catch(() => {});
    } else {
      getOrganizerEvents(user.id).then((evts) => setEvents(evts.filter((e) => e.status === "published")));
    }
  }, [user, isSuperAdmin]);

  const loadPasses = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/service-providers?eventId=${selectedEvent}`);
      const json = await res.json();
      setPasses(json.passes ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => { loadPasses(); }, [loadPasses]);

  const resetForm = () => {
    setFullName("");
    setCompanyName("");
    setPosition("");
    setPhoto(null);
    setPhotoPreview(null);
    setFormError(null);
  };

  const handlePhotoSelect = (file: File | null) => {
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !companyName.trim() || !position.trim()) {
      setFormError("Full name, company/business name, and position are all required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const form = new FormData();
      form.set("eventId", selectedEvent);
      form.set("fullName", fullName.trim());
      form.set("companyName", companyName.trim());
      form.set("position", position.trim());
      if (photo) form.set("photo", photo);

      const res = await fetch("/api/service-providers", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Failed to create pass.");
        return;
      }
      setDialogOpen(false);
      resetForm();
      loadPasses();
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (pass: ServiceProviderPass) => {
    if (!confirm(`Revoke ${pass.full_name}'s pass? This can't be undone.`)) return;
    const res = await fetch(`/api/service-providers/${pass.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "Failed to revoke pass.");
      return;
    }
    loadPasses();
  };

  const activePasses = passes.filter((p) => !p.revoked);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Service Provider Passes</h1>
        <p className="text-muted-foreground mt-1">
          Issue printable, QR-verifiable ID passes for event-day crew — ushers, security, DJs, sound
          engineers, and anyone else working your event who doesn&apos;t need a platform login.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Event</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose an event" />
            </SelectTrigger>
            <SelectContent>
              {events.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No published events</div>
              )}
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title} - {new Date(event.date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedEvent && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5" />
              Issued Passes {!loading && `(${activePasses.length})`}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={loadPasses} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button className="gap-2" onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" />
                New Pass
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : passes.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No passes issued yet for this event.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {passes.map((pass) => (
                  <div
                    key={pass.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${pass.revoked ? "opacity-50" : ""}`}
                  >
                    {pass.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pass.photo_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{pass.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pass.position} · {pass.company_name}
                      </p>
                      {pass.revoked && <p className="text-xs text-destructive font-medium">Revoked</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <a href={`/api/service-providers/${pass.id}/badge`} download>
                        <Button variant="ghost" size="icon" title="Download badge">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      {!pass.revoked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Revoke pass"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevoke(pass)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Service Provider Pass</DialogTitle>
            <DialogDescription>
              Creates a printable, QR-verifiable ID badge for this event only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Photo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
              />
              <div
                className="mt-1.5 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed hover:border-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="sp-name">Full Name *</Label>
              <Input id="sp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="sp-company">Company / Business Name *</Label>
              <Input id="sp-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="sp-position">Position *</Label>
              <Input
                id="sp-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Security, DJ, Sound Engineer…"
                list="sp-position-suggestions"
                className="mt-1.5"
              />
              <datalist id="sp-position-suggestions">
                {COMMON_POSITIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Type anything — the suggestions are just a starting point.
              </p>
            </div>

            {formError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create Pass"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
