"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { ArrowLeft, Plus, Trash2, Save, RefreshCw, Upload, X, Image as ImageIcon, Pencil } from "lucide-react";
import { EVENT_CATEGORIES, Event, EventCategory, TicketType, EventAddOn } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { getEventById, saveEvent } from "@/lib/events-store";
import { compressImageFile } from "@/lib/image-compress";

interface TicketTypeForm {
  key: string;
  id?: string; // real UUID once saved; undefined = new
  name: string;
  description: string;
  price: string;
  quantity: string;
  sold: number;
}

interface AddOnForm {
  key: string;
  id?: string;
  name: string;
  description: string;
  price: string;
  quantity: string; // "" = unlimited
  sold: number;
}

// Organizer-facing event editor. Lets an organizer fix their own listing's
// details, ticket types, add-ons and sales settings (including the public
// sold/available count toggle and pay-in-parts). Per-class custom charges stay
// admin-only — they're preserved from the loaded event and never rendered here.
export default function OrganizerEditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([]);
  const [addOns, setAddOns] = useState<AddOnForm[]>([]);
  const [showTicketCounts, setShowTicketCounts] = useState(false);
  const [allowSplitPayment, setAllowSplitPayment] = useState(false);
  const [splitDepositPercent, setSplitDepositPercent] = useState("30");
  const [splitInstallmentCount, setSplitInstallmentCount] = useState("2");

  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const ev = await getEventById(id);
      if (!ev) {
        setLoadError("Event not found");
        return;
      }
      // Only the owner (or an admin) may edit — mirrors the events RLS policy.
      if (ev.organizerId !== user?.id && !isAdmin) {
        setLoadError("You don't have permission to edit this event");
        return;
      }
      setEvent(ev);
      setTitle(ev.title);
      setDescription(ev.description);
      setCategory(ev.category);
      setDate(ev.date);
      setTime(ev.time);
      setVenue(ev.venue);
      setCity(ev.city);
      setCurrentImageUrl(ev.image || null);
      setTicketTypes(
        ev.ticketTypes.map((tt) => ({
          key: tt.id,
          id: tt.id,
          name: tt.name,
          description: tt.description,
          price: String(tt.price),
          quantity: String(tt.quantity),
          sold: tt.sold,
        }))
      );
      setAddOns(
        (ev.addOns || []).map((a) => ({
          key: a.id,
          id: a.id,
          name: a.name,
          description: a.description || "",
          price: String(a.price),
          quantity: a.quantity == null ? "" : String(a.quantity),
          sold: a.sold,
        }))
      );
      setShowTicketCounts(!!ev.showTicketCounts);
      setAllowSplitPayment(!!ev.allowSplitPayment);
      setSplitDepositPercent(String(ev.splitDepositPercent || 30));
      setSplitInstallmentCount(String(ev.splitInstallmentCount || 2));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, isAdmin]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  const addTicketType = () => {
    setTicketTypes([
      ...ticketTypes,
      { key: `new-${Date.now()}`, name: "", description: "", price: "", quantity: "", sold: 0 },
    ]);
  };

  const removeTicketType = (key: string) => {
    // Only brand-new, unsaved rows can be removed — an existing type may have
    // sales tied to it, so deleting it is a separate, careful operation.
    setTicketTypes(ticketTypes.filter((t) => t.key !== key || t.id));
  };

  const updateTicketType = (key: string, field: keyof TicketTypeForm, value: string) => {
    setTicketTypes(ticketTypes.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };

  const addAddOn = () => {
    setAddOns([
      ...addOns,
      { key: `addon-${Date.now()}`, name: "", description: "", price: "", quantity: "", sold: 0 },
    ]);
  };

  const removeAddOn = (key: string) => {
    setAddOns(addOns.filter((a) => a.key !== key));
  };

  const updateAddOn = (key: string, field: keyof AddOnForm, value: string) => {
    setAddOns(addOns.map((a) => (a.key === key ? { ...a, [field]: value } : a)));
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingImage(true);
    try {
      const compressed = await compressImageFile(file);
      setFeaturedImage(compressed);
      setFeaturedImagePreview(URL.createObjectURL(compressed));
    } catch (err) {
      setSaveError("Failed to process image" + (err instanceof Error ? ` (${err.message})` : ""));
    } finally {
      setCompressingImage(false);
    }
  };

  const handleSave = async () => {
    if (!event) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Merge form values onto the loaded event so untouched fields (status,
      // organizer, promo video, gallery, custom fields, per-class fees…) are
      // preserved exactly as they were.
      const origTicketById = new Map(event.ticketTypes.map((t) => [t.id, t]));
      const nextTicketTypes: TicketType[] = ticketTypes
        .filter((t) => t.name.trim())
        .map((t) => {
          const orig = t.id ? origTicketById.get(t.id) : undefined;
          const sold = orig?.sold ?? t.sold;
          const parsed = parseInt(t.quantity);
          // Empty/invalid quantity keeps the existing stock (or 0 for a new
          // type); never let it drop below what's already sold.
          const baseQty = Number.isFinite(parsed) ? parsed : orig?.quantity ?? 0;
          return {
            id: t.id || "",
            name: t.name.trim(),
            description: t.description,
            price: parseFloat(t.price) || 0,
            currency: "USD" as const,
            quantity: Math.max(sold, baseQty),
            sold,
            markup: orig?.markup,
            // Per-class custom fees are admin-only — carry the stored values
            // through untouched (the DB trigger also guards them).
            customChargeFixed: orig?.customChargeFixed,
            customChargePercent: orig?.customChargePercent,
            customMarkupFixed: orig?.customMarkupFixed,
            customMarkupPercent: orig?.customMarkupPercent,
          };
        });

      const nextAddOns: EventAddOn[] = addOns
        .filter((a) => a.name.trim())
        .map((a, i) => {
          const qty = a.quantity.trim() === "" ? null : parseInt(a.quantity);
          return {
            id: a.id || "",
            name: a.name.trim(),
            description: a.description.trim(),
            price: parseFloat(a.price) || 0,
            quantity: qty === null ? null : Math.max(a.sold, Number.isFinite(qty) ? qty : 0),
            sold: a.sold,
            position: i,
          };
        });

      const updated: Event = {
        ...event,
        title: title.trim(),
        description,
        category: (category || event.category) as EventCategory,
        date,
        time,
        venue,
        city,
        ticketTypes: nextTicketTypes,
        addOns: nextAddOns,
        showTicketCounts,
        allowSplitPayment,
        splitDepositPercent: allowSplitPayment ? parseFloat(splitDepositPercent) || 30 : 30,
        splitInstallmentCount: allowSplitPayment ? parseInt(splitInstallmentCount) || 2 : 2,
        totalTickets: nextTicketTypes.reduce((sum, t) => sum + t.quantity, 0),
        updatedAt: new Date().toISOString(),
      };

      await saveEvent(updated);

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
          setSaveError(
            "Event details saved, but the featured image failed to upload" +
              (err instanceof Error ? ` (${err.message})` : "")
          );
          setSaving(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      router.push("/creator/events");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold">Sign in required</h1>
        <p className="mt-2 text-muted-foreground">You need to be signed in to edit an event.</p>
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

  if (loadError || !event) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold text-destructive">Couldn&apos;t Load Event</h1>
        <p className="mt-2 text-muted-foreground">{loadError || "Event not found"}</p>
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Edit Event
          </h1>
          <p className="text-sm text-muted-foreground">{event.title}</p>
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
          <CardDescription>Replace the event listing image</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {compressingImage ? (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Spinner className="h-6 w-6" />
              <p className="text-sm">Optimizing your image…</p>
            </div>
          ) : featuredImagePreview || currentImageUrl ? (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={featuredImagePreview || currentImageUrl || ""}
                  alt="Featured preview"
                  className="w-full h-auto max-h-48 object-cover rounded-lg"
                />
                {featuredImagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeaturedImage(null);
                      setFeaturedImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-2 rounded-lg hover:bg-destructive/90"
                    title="Remove selected image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {featuredImagePreview ? "Choose a different image" : "Replace image"}
                </Button>
                {featuredImagePreview && (
                  <p className="text-xs text-muted-foreground self-center">New image selected — save to apply.</p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFeaturedImageUpload}
                className="hidden"
              />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/20 p-8 cursor-pointer hover:bg-primary/5 transition-colors">
              <ImageIcon className="h-10 w-10 text-primary/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Click to upload featured image</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, or GIF</p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
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
            Editing a type with tickets already sold can&apos;t drop its quantity below what&apos;s sold. You can add a new type, but existing ones can&apos;t be removed here.
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

      {/* Sales & payment settings — includes the public sold/available count
          toggle the organizer asked to control from the edit screen. */}
      <Card>
        <CardHeader>
          <CardTitle>Sales &amp; Payments</CardTitle>
          <CardDescription>Visibility and payment-plan options for buyers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              checked={showTicketCounts}
              onChange={(e) => setShowTicketCounts(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">Show sold / available ticket counts</span>
              <span className="block text-xs text-muted-foreground">
                Display &quot;X sold&quot; and availability on the event card and detail page. Turn off to hide totals.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              checked={allowSplitPayment}
              onChange={(e) => setAllowSplitPayment(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">Allow pay-in-parts (deposit + installments)</span>
              <span className="block text-xs text-muted-foreground">
                Buyers can pay a deposit now and settle the balance later with any payment method.
              </span>
            </span>
          </label>

          {allowSplitPayment && (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              <div>
                <Label>Deposit percentage</Label>
                <Input type="number" min="10" max="90" value={splitDepositPercent} onChange={(e) => setSplitDepositPercent(e.target.value)} className="mt-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">% of the total charged up front (10–90).</p>
              </div>
              <div>
                <Label>Suggested installments</Label>
                <Input type="number" min="1" value={splitInstallmentCount} onChange={(e) => setSplitInstallmentCount(e.target.value)} className="mt-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">How many parts the balance is split into (informational).</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid add-ons */}
      <Card>
        <CardHeader>
          <CardTitle>Add-ons</CardTitle>
          <CardDescription>
            Optional extras buyers can add at checkout (merch, books, caps…). Leave quantity blank for unlimited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {addOns.map((a) => (
            <div key={a.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {a.id ? `Add-on${a.sold > 0 ? ` — ${a.sold} sold` : ""}` : "New Add-on"}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeAddOn(a.key)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={a.name} onChange={(e) => updateAddOn(a.key, "name", e.target.value)} className="mt-1.5" placeholder="e.g. Event T-Shirt" />
                </div>
                <div>
                  <Label>Price (USD)</Label>
                  <Input type="number" min="0" step="0.01" value={a.price} onChange={(e) => updateAddOn(a.key, "price", e.target.value)} className="mt-1.5" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Input value={a.description} onChange={(e) => updateAddOn(a.key, "description", e.target.value)} className="mt-1.5" placeholder="Optional short description" />
                </div>
                <div>
                  <Label>Stock (blank = unlimited)</Label>
                  <Input type="number" min={a.sold} value={a.quantity} onChange={(e) => updateAddOn(a.key, "quantity", e.target.value)} className="mt-1.5" placeholder="Unlimited" />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full gap-2" onClick={addAddOn}>
            <Plus className="h-4 w-4" />
            Add an Add-on
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button className="gap-2" onClick={handleSave} disabled={saving || uploadingImage}>
          {saving || uploadingImage ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving || uploadingImage ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
