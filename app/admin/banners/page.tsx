"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, X, Image as ImageIcon, Link as LinkIcon, LayoutTemplate, Layers, DollarSign, CheckCircle2, RefreshCw } from "lucide-react";
import { Banner } from "@/lib/types";

export default function BannerManagementPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      const json = await res.json();
      const rows = (json.banners ?? []) as Record<string, unknown>[];
      setBanners(rows.map((r) => ({
        id: r.id as string,
        type: r.type as "hero" | "section",
        position: r.position as number,
        image: (r.image as string) || undefined,
        link: (r.link as string) || undefined,
        title: (r.title as string) || undefined,
        pricePerDay: Number(r.price_per_day),
        status: r.status as Banner["status"],
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const heroBanners = banners.filter(b => b.type === "hero");
  const sectionBanners = banners.filter(b => b.type === "section");

  const openEditor = (banner: Banner) => {
    setEditingBanner(banner);
    setDraftTitle(banner.title || "");
    setDraftLink(banner.link || "");
    setDraftFile(null);
    setDraftPreview(null);
    setDialogOpen(true);
  };

  const handleFileSelect = (file: File | null) => {
    setDraftFile(file);
    setDraftPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSaveBanner = async () => {
    if (!editingBanner) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("title", draftTitle);
      form.set("link", draftLink);
      if (draftFile) form.set("image", draftFile);

      await fetch(`/api/admin/banners/${editingBanner.id}`, { method: "PATCH", body: form });
      setDialogOpen(false);
      setEditingBanner(null);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (bannerId: string) => {
    const form = new FormData();
    form.set("clear", "true");
    await fetch(`/api/admin/banners/${bannerId}`, { method: "PATCH", body: form });
    reload();
  };

  const activeCount = banners.filter(b => b.status === "active").length;
  const availableCount = banners.filter(b => b.status === "available").length;
  const totalDailyRevenue = banners.filter(b => b.status === "active").reduce((s, b) => s + b.pricePerDay, 0);

  const statusCfg = {
    active: { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Active" },
    available: { cls: "bg-amber-100 text-amber-700 border-amber-200", label: "Available" },
    pending: { cls: "bg-blue-100 text-blue-700 border-blue-200", label: "Pending" },
    expired: { cls: "bg-gray-100 text-gray-700 border-gray-200", label: "Expired" },
  } as const;

  const BannerCard = ({ banner }: { banner: Banner }) => {
    const cfg = statusCfg[banner.status] ?? statusCfg.available;
    return (
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="aspect-[3/1] bg-muted/60 flex items-center justify-center border-b relative">
          {banner.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image} alt={banner.title || "Banner"} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
              <ImageIcon className="h-7 w-7" />
              <span className="text-xs">Slot available</span>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
              #{banner.position}
            </span>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-sm">
                {banner.type === "hero" ? "Hero Slide" : "Section"} #{banner.position}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-emerald-700">
                <DollarSign className="h-3 w-3" />
                <span className="text-xs font-medium">{banner.pricePerDay}/day</span>
              </div>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
              {cfg.label}
            </span>
          </div>

          <div className="flex gap-2">
            {!banner.image ? (
              <Button size="sm" className="flex-1 gap-1.5" onClick={() => openEditor(banner)}>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditor(banner)}>
                  Replace
                </Button>
                <Button size="sm" variant="destructive" className="px-2.5" onClick={() => handleRemove(banner.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Banner Management</h1>
          <p className="text-muted-foreground mt-1">
            Upload or replace a banner and it goes live on the homepage immediately — no deploy needed.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active Banners", value: activeCount, icon: CheckCircle2, accent: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
          { label: "Open Slots", value: availableCount, icon: Layers, accent: "bg-amber-500", light: "bg-amber-50 text-amber-600" },
          { label: "Daily Revenue", value: `$${totalDailyRevenue}`, icon: DollarSign, accent: "bg-violet-500", light: "bg-violet-50 text-violet-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${s.accent}`} />
            <CardContent className="p-5 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.light}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                <LayoutTemplate className="h-4 w-4 text-violet-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Hero Slider</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Full-width slides on the homepage</p>
              </div>
              <Badge variant="outline" className="text-xs">{heroBanners.filter(b => b.status === "active").length}/{heroBanners.length} active</Badge>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {heroBanners.map(b => <BannerCard key={b.id} banner={b} />)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <Layers className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Section Banners</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Inline banners shown between event listings</p>
              </div>
              <Badge variant="outline" className="text-xs">{sectionBanners.filter(b => b.status === "active").length}/{sectionBanners.length} active</Badge>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sectionBanners.map(b => <BannerCard key={b.id} banner={b} />)}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBanner?.image ? "Replace Banner" : "Upload Banner"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {editingBanner && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60 border text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                  #{editingBanner.position}
                </div>
                <div>
                  <p className="font-medium">{editingBanner.type === "hero" ? "Hero Slide" : "Section Banner"} #{editingBanner.position}</p>
                  <p className="text-xs text-muted-foreground">${editingBanner.pricePerDay}/day · {editingBanner.type === "hero" ? "1200×400px" : "970×250px"}</p>
                </div>
              </div>
            )}

            <div>
              <Label>Banner Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              <div
                className="mt-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {draftPreview || editingBanner?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draftPreview || editingBanner?.image} alt="Preview" className="mx-auto max-h-40 rounded-lg object-cover" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to upload</p>
                  </>
                )}
                <p className="text-xs text-muted-foreground mt-2">PNG, JPG, WebP · {editingBanner?.type === "hero" ? "1200×400px recommended" : "970×250px recommended"}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="banner-title">Title (Optional)</Label>
              <Input
                id="banner-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="e.g. Summer Festival 2026"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="banner-link">Destination URL (Optional)</Label>
              <div className="relative mt-1.5">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="banner-link"
                  value={draftLink}
                  onChange={(e) => setDraftLink(e.target.value)}
                  placeholder="/events/some-event-id"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveBanner} disabled={saving}>{saving ? "Saving…" : "Save Banner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
