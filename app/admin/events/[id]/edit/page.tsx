"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Plus, Trash2, Save, RefreshCw, Upload, X, Image as ImageIcon } from "lucide-react";
import { EVENT_CATEGORIES, Event } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { compressImageFile } from "@/lib/image-compress";

interface TicketTypeForm {
  id?: string; // undefined = new, not yet saved
  key: string; // stable local key for React lists
  name: string;
  description: string;
  price: string;
  quantity: string;
  sold: number;
}

// Full event editing — Super Admin only. Lets a Super Admin fix or update a
// client-organizer's listing directly (see PATCH /api/admin/events/[id]).
export default function AdminEditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSuperAdmin, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [organizerName, setOrganizerName] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([]);

  // Featured image upload state
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/events/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Failed to load event");
        return;
      }
      const event: Event = data.event;
      setTitle(event.title);
      setDescription(event.description);
      setCategory(event.category);
      setDate(event.date);
      setTime(event.time);
      setVenue(event.venue);
      setCity(event.city);
      setOrganizerName(event.organizerName);
      setCurrentImageUrl(event.image || null);
      setTicketTypes(
        event.ticketTypes.map((tt) => ({
          id: tt.id,
          key: tt.id,
          name: tt.name,
          description: tt.description,
          price: String(tt.price),
          quantity: String(tt.quantity),
          sold: tt.sold,
        }))
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) load();
  }, [authLoading, isSuperAdmin, load]);

  const addTicketType = () => {
    setTicketTypes([
      ...ticketTypes,
      { key: `new-${Date.now()}`, name: "", description: "", price: "", quantity: "", sold: 0 },
    ]);
  };

  const removeTicketType = (key: string) => {
    // Only newly-added, unsaved rows can be removed here — an existing
    // ticket type may already have sales tied to it, so deleting it is a
    // separate, more careful operation this form doesn't attempt.
    setTicketTypes(ticketTypes.filter((t) => t.key !== key || t.id));
  };

  const updateTicketType = (key: string, field: keyof TicketTypeForm, value: string) => {
    setTicketTypes(ticketTypes.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressingImage(true);
    try {
      const compressed = await compressImageFile(file);
      setFeaturedImage(compressed);
      setFeaturedImagePreview(URL.createObjectURL(compressed));
    } finally {
      setCompressingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // First save event details
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          date,
          time,
          venue,
          city,
          ticketTypes: ticketTypes.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            price: parseFloat(t.price) || 0,
            quantity: parseInt(t.quantity) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to save changes");
        return;
      }

      // Then upload image if one was selected
      if (featuredImage) {
        setUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append("image", featuredImage);
          formData.append("eventId", id);
          const imageRes = await fetch("/api/organizer/events/image", {
            method: "POST",
            body: formData,
          });
          if (!imageRes.ok) {
            const body = await imageRes.json().catch(() => ({}));
            throw new Error(body.error || `Upload failed (${imageRes.status})`);
          }
        } catch (err) {
          console.error("Failed to upload featured image:", err);
          setSaveError(
            "Event details saved, but the featured image failed to upload" +
              (err instanceof Error ? ` (${err.message})` : "")
          );
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      router.push("/private/events");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold">Super Admin Only</h1>
        <p className="mt-2 text-muted-foreground">Editing another organizer&apos;s event listing is restricted to Super Admin.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold text-destructive">Couldn&apos;t Load Event</h1>
        <p className="mt-2 text-muted-foreground">{loadError}</p>
        <Button className="mt-4" onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Event</h1>
          <p className="text-sm text-muted-foreground">Listed by {organizerName}</p>
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Core listing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Event Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" rows={4} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="venue">Venue</Label>
              <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Featured Image</CardTitle>
          <CardDescription>Upload a featured image for the event listing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {compressingImage ? (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Spinner className="h-6 w-6" />
              <p className="text-sm">Optimizing your image…</p>
            </div>
          ) : featuredImagePreview || currentImageUrl ? (
            <div className="relative">
              <img
                src={featuredImagePreview || currentImageUrl || ""}
                alt="Featured preview"
                className="w-full h-auto max-h-48 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setFeaturedImage(null);
                  setFeaturedImagePreview(null);
                }}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-2 rounded-lg hover:bg-destructive/90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/20 p-8 cursor-pointer hover:bg-primary/5 transition-colors">
              <ImageIcon className="h-10 w-10 text-primary/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Click to upload featured image</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPEG, WebP, or GIF (max 20MB)</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFeaturedImageUpload}
                className="hidden"
              />
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Types</CardTitle>
          <CardDescription>
            Editing a type with tickets already sold can&apos;t drop its quantity below what&apos;s sold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticketTypes.map((tt) => (
            <div key={tt.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {tt.id ? `Ticket Type${tt.sold > 0 ? ` — ${tt.sold} sold` : ""}` : "New Ticket Type"}
                </span>
                {!tt.id && (
                  <Button variant="ghost" size="icon" onClick={() => removeTicketType(tt.key)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={tt.name} onChange={(e) => updateTicketType(tt.key, "name", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={tt.description} onChange={(e) => updateTicketType(tt.key, "description", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Price (USD)</Label>
                  <Input type="number" min="0" step="0.01" value={tt.price} onChange={(e) => updateTicketType(tt.key, "price", e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={tt.sold} value={tt.quantity} onChange={(e) => updateTicketType(tt.key, "quantity", e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full gap-2" onClick={addTicketType}>
            <Plus className="h-4 w-4" />
            Add Another Ticket Type
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
