"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Settings2, Percent, Zap, CreditCard, Megaphone, ShieldCheck,
  Save, RotateCcw, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Upload, X, DollarSign,
} from "lucide-react";
import { ANNOUNCEMENT_AD_PRICE_PER_2_WEEKS } from "@/lib/types";

interface PlatformConfig {
  service_fee_percent: number;
  new_registrations: boolean;
  new_organizer_signups: boolean;
  maintenance_mode: boolean;
  online_payments: boolean;
  stripe_enabled: boolean;
  paynow_enabled: boolean;
  announcement_active: boolean;
  announcement_message: string;
  announcement_type: "info" | "warning" | "error" | "ad";
  announcement_image?: string | null;
  announcement_link?: string | null;
}

export default function PlatformPage() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [original, setOriginal] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feeInput, setFeeInput] = useState("10");
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adPreview, setAdPreview] = useState<string | null>(null);
  const [uploadingAd, setUploadingAd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform-config");
      const json = await res.json();
      setConfig(json.config);
      setOriginal(json.config);
      setFeeInput(String(json.config.service_fee_percent));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const setFeature = <K extends keyof PlatformConfig>(key: K, val: PlatformConfig[K]) => {
    setConfig(prev => prev ? { ...prev, [key]: val } : prev);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fee = parseFloat(feeInput);
      const res = await fetch("/api/admin/platform", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_fee_percent: isNaN(fee) ? 10 : Math.min(Math.max(fee, 0), 50),
          new_registrations: config.new_registrations,
          new_organizer_signups: config.new_organizer_signups,
          maintenance_mode: config.maintenance_mode,
          online_payments: config.online_payments,
          stripe_enabled: config.stripe_enabled,
          paynow_enabled: config.paynow_enabled,
          announcement_active: config.announcement_active,
          announcement_message: config.announcement_message,
          announcement_type: config.announcement_type,
          announcement_link: config.announcement_link ?? "",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setConfig(json.config);
        setOriginal(json.config);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAdFileSelect = (file: File | null) => {
    setAdFile(file);
    setAdPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleAdUpload = async () => {
    if (!adFile) return;
    setUploadingAd(true);
    try {
      const form = new FormData();
      form.set("image", adFile);
      const res = await fetch("/api/admin/platform/announcement-image", { method: "POST", body: form });
      const json = await res.json();
      if (res.ok) {
        setConfig(json.config);
        setOriginal(json.config);
        setAdFile(null);
        setAdPreview(null);
      }
    } finally {
      setUploadingAd(false);
    }
  };

  const handleAdClear = async () => {
    setUploadingAd(true);
    try {
      const form = new FormData();
      form.set("clear", "true");
      await fetch("/api/admin/platform/announcement-image", { method: "POST", body: form });
      setFeature("announcement_image", null);
      setOriginal(prev => prev ? { ...prev, announcement_image: null } : prev);
    } finally {
      setUploadingAd(false);
    }
  };

  const handleReset = () => {
    if (original) {
      setConfig(original);
      setFeeInput(String(original.service_fee_percent));
    }
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Configuration</h1>
          <p className="text-muted-foreground mt-1">Control fees, feature availability, payment gateways, and announcements — every toggle here takes effect immediately, site-wide.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <Button variant="outline" onClick={handleReset} className="gap-2" disabled={saving}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleSave} className="gap-2 bg-primary" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <Percent className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">Service Fee</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Percentage added to every ticket sale as platform revenue. Read live by checkout — changes apply to the next purchase.</p>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="fee">Fee Percentage</Label>
                <div className="relative">
                  <Input
                    id="fee"
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={feeInput}
                    onChange={e => setFeeInput(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="pb-1">
                <p className="text-xs text-muted-foreground">For a $100 ticket</p>
                <p className="text-lg font-mono font-bold text-emerald-600">+${((parseFloat(feeInput) || 0)).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <Zap className="h-4 w-4 text-violet-600" />
              </div>
              <CardTitle className="text-base">Feature Controls</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 divide-y">
            {([
              { key: "maintenance_mode" as const, label: "Maintenance Mode", desc: "Takes the site offline for all non-admin visitors", danger: true },
              { key: "new_registrations" as const, label: "New Registrations", desc: "Allow new users to create accounts" },
              { key: "new_organizer_signups" as const, label: "New Organizer Signups", desc: "Allow organizers to request accounts" },
              { key: "online_payments" as const, label: "Online Payments", desc: "Master switch for all payment processing" },
              { key: "stripe_enabled" as const, label: "Stripe Gateway", desc: "Card payments via Stripe" },
              { key: "paynow_enabled" as const, label: "Paynow Gateway", desc: "Zimbabwe payments via Paynow" },
            ] as const).map(f => (
              <div key={f.key} className="flex items-center justify-between py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{f.label}</p>
                    {'danger' in f && f.danger && config[f.key] && (
                      <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1.5">ACTIVE</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
                <Switch
                  checked={config[f.key]}
                  onCheckedChange={val => setFeature(f.key, val)}
                  className={'danger' in f && f.danger && config[f.key] ? "data-[state=checked]:bg-red-500" : ""}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <CreditCard className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base">Payment Gateways</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {[
              {
                name: "Stripe",
                desc: "International cards · USD settlement",
                enabled: config.stripe_enabled,
                docsUrl: "https://dashboard.stripe.com",
              },
              {
                name: "Paynow",
                desc: "Zimbabwe local gateway · USD & ZWL",
                enabled: config.paynow_enabled,
                docsUrl: "https://www.paynow.co.zw",
              },
            ].map(gw => (
              <div key={gw.name} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${gw.enabled ? "bg-emerald-100" : "bg-red-100"}`}>
                    {gw.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{gw.name}</p>
                      <Badge className={`text-[10px] px-1.5 border-0 ${gw.enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {gw.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{gw.desc}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => window.open(gw.docsUrl, "_blank")}>
                  Dashboard ↗
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Toggle gateways using Feature Controls above — enforced on the payment initiation endpoint, not just this UI.</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <Megaphone className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle className="text-base">Platform Announcement</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Shows a dismissible banner to all site visitors — an internal notice (maintenance, promotions,
              updates) or a paid sponsored ad slot at ${ANNOUNCEMENT_AD_PRICE_PER_2_WEEKS}/2 weeks.
            </p>
            <div className="flex items-center justify-between">
              <Label htmlFor="ann-active">Show Announcement</Label>
              <Switch
                id="ann-active"
                checked={config.announcement_active}
                onCheckedChange={v => setFeature("announcement_active", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={config.announcement_type}
                onValueChange={v => setFeature("announcement_type", v as PlatformConfig["announcement_type"])}
                disabled={!config.announcement_active}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info (Blue)</SelectItem>
                  <SelectItem value="warning">Warning (Amber)</SelectItem>
                  <SelectItem value="error">Critical (Red)</SelectItem>
                  <SelectItem value="ad">Sponsored Ad (${ANNOUNCEMENT_AD_PRICE_PER_2_WEEKS}/2wk)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.announcement_type === "ad" ? (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  Sponsored ad — ${ANNOUNCEMENT_AD_PRICE_PER_2_WEEKS} per 2-week run
                </div>
                <div className="space-y-1.5">
                  <Label>Banner Image</Label>
                  {config.announcement_image && !adPreview && (
                    <div className="relative overflow-hidden rounded-lg border">
                      <img src={config.announcement_image} alt="Announcement ad" className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        onClick={handleAdClear}
                        disabled={uploadingAd}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {adPreview && (
                    <img src={adPreview} alt="Preview" className="h-20 w-full rounded-lg border object-cover" />
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => handleAdFileSelect(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                    {adFile && (
                      <Button size="sm" onClick={handleAdUpload} disabled={uploadingAd} className="gap-1.5 shrink-0">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingAd ? "Uploading…" : "Upload"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Destination Link</Label>
                  <Input
                    value={config.announcement_link ?? ""}
                    onChange={e => setFeature("announcement_link", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  value={config.announcement_message}
                  onChange={e => setFeature("announcement_message", e.target.value)}
                  placeholder="e.g. We are currently experiencing intermittent issues with Paynow payments. We are working to resolve this."
                  rows={3}
                  disabled={!config.announcement_active}
                />
              </div>
            )}

            {config.announcement_active && config.announcement_type !== "ad" && config.announcement_message && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                config.announcement_type === "error" ? "bg-red-50 text-red-800 border border-red-200" :
                config.announcement_type === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                "bg-blue-50 text-blue-800 border border-blue-200"
              }`}>
                <Megaphone className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{config.announcement_message}</p>
              </div>
            )}
            {config.announcement_active && config.announcement_type === "ad" && config.announcement_image && (
              <div className="overflow-hidden rounded-lg border">
                <div className="relative">
                  <img src={config.announcement_image} alt="Ad preview" className="h-16 w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-white">
                    Sponsored
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
              </div>
              <CardTitle className="text-base">Security Posture</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "API Keys", value: "Env-managed", ok: true, note: "Stored in Vercel env vars" },
                { label: "Webhook Signing", value: "Stripe only", ok: true, note: "STRIPE_WEBHOOK_SECRET must be set" },
                { label: "PCI Compliance", value: "Stripe handles", ok: true, note: "No card data touches our servers" },
                { label: "Maintenance Mode", value: config.maintenance_mode ? "Active" : "Off", ok: !config.maintenance_mode, note: "Enforced in middleware" },
              ].map(s => (
                <div key={s.label} className="rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    {s.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                  <p className="text-sm font-semibold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
