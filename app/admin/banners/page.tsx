"use client";

import { useState } from "react";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, X, Image as ImageIcon, Link as LinkIcon, LayoutTemplate, Layers, DollarSign, CheckCircle2 } from "lucide-react";
import { mockBanners } from "@/lib/mock-data";
import { Banner } from "@/lib/types";

export default function BannerManagementPage() {
  const [banners, setBanners] = useState<Banner[]>(mockBanners);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const heroBanners = banners.filter(b => b.type === "hero");
  const sectionBanners = banners.filter(b => b.type === "section");

  const handleUpload = (bannerId: string) => {
    // Simulate file upload
    setBanners(prev => prev.map(b => 
      b.id === bannerId 
        ? { ...b, image: "/placeholder-banner.jpg", status: "active" as const }
        : b
    ));
  };

  const handleRemove = (bannerId: string) => {
    setBanners(prev => prev.map(b => 
      b.id === bannerId 
        ? { ...b, image: "", link: "", title: "", status: "available" as const }
        : b
    ));
  };

  const handleSaveBanner = () => {
    if (editingBanner) {
      setBanners(prev => prev.map(b => 
        b.id === editingBanner.id ? editingBanner : b
      ));
    }
    setDialogOpen(false);
    setEditingBanner(null);
  };

  const activeCount    = banners.filter(b => b.status === "active").length;
  const availableCount = banners.filter(b => b.status === "available").length;
  const totalDailyRevenue = banners.filter(b => b.status === "active").reduce((s, b) => s + b.pricePerDay, 0);

  const statusCfg = {
    active:    { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Active" },
    available: { cls: "bg-amber-100 text-amber-700 border-amber-200",       label: "Available" },
    reserved:  { cls: "bg-blue-100 text-blue-700 border-blue-200",          label: "Reserved" },
  } as const;

  const BannerCard = ({ banner }: { banner: Banner }) => {
    const cfg = statusCfg[banner.status as keyof typeof statusCfg] ?? statusCfg.available;
    return (
      <Card className="border-0 shadow-sm overflow-hidden">
        {/* Preview area */}
        <div className="aspect-[3/1] bg-muted/60 flex items-center justify-center border-b relative">
          {banner.image ? (
            <div className="absolute inset-0 bg-linear-to-r from-primary/10 to-primary/5 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="h-6 w-6 mx-auto text-primary/40 mb-1" />
                <span className="text-xs font-medium text-primary/60">{banner.title || "Banner uploaded"}</span>
              </div>
            </div>
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
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => { setEditingBanner(banner); setDialogOpen(true); }}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setEditingBanner(banner); setDialogOpen(true); }}
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="px-2.5"
                  onClick={() => handleRemove(banner.id)}
                >
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

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Banner Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage hero slider and section banners sold to advertisers
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active Banners", value: activeCount,    icon: CheckCircle2, accent: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
          { label: "Open Slots",     value: availableCount, icon: Layers,       accent: "bg-amber-500",   light: "bg-amber-50 text-amber-600" },
          { label: "Daily Revenue",  value: `$${totalDailyRevenue}`, icon: DollarSign, accent: "bg-violet-500", light: "bg-violet-50 text-violet-600" },
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

      {/* Hero Slider */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 border-b pb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
            <LayoutTemplate className="h-4 w-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Hero Slider</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Up to 10 full-width slides on the homepage</p>
          </div>
          <Badge variant="outline" className="text-xs">{heroBanners.filter(b => b.status === "active").length}/{heroBanners.length} active</Badge>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {heroBanners.map(b => <BannerCard key={b.id} banner={b} />)}
          </div>
        </CardContent>
      </Card>

      {/* Section Banners */}
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

      {/* Upload / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBanner?.image ? "Replace Banner" : "Upload Banner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Slot info */}
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
              <div
                className="mt-2 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => editingBanner && handleUpload(editingBanner.id)}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP · {editingBanner?.type === "hero" ? "1200×400px recommended" : "970×250px recommended"}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="banner-title">Title (Optional)</Label>
              <Input
                id="banner-title"
                value={editingBanner?.title || ""}
                onChange={(e) => setEditingBanner(prev => prev ? { ...prev, title: e.target.value } : null)}
                placeholder="e.g. Summer Festival 2025"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="banner-link">Destination URL (Optional)</Label>
              <div className="relative mt-1.5">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="banner-link"
                  value={editingBanner?.link || ""}
                  onChange={(e) => setEditingBanner(prev => prev ? { ...prev, link: e.target.value } : null)}
                  placeholder="/events/evt-001"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBanner}>Save Banner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
