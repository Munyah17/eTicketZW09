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
  Save, RotateCcw, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { getPlatformConfig, savePlatformConfig, PlatformConfig } from "@/lib/platform-config";
import { useAuth } from "@/lib/auth-context";
import { logAuditAction } from "@/lib/audit-logger";

export default function PlatformPage() {
  const { user: adminUser } = useAuth();
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [feeInput, setFeeInput] = useState("10");

  useEffect(() => {
    const c = getPlatformConfig();
    setConfig(c);
    setFeeInput(c.serviceFeePercent.toString());
  }, []);

  if (!config) return null;

  const setFeature = (key: keyof PlatformConfig["features"], val: boolean) => {
    setConfig(prev => prev ? { ...prev, features: { ...prev.features, [key]: val } } : prev);
  };

  const setAnnouncement = (key: keyof PlatformConfig["announcement"], val: string | boolean) => {
    setConfig(prev => prev ? { ...prev, announcement: { ...prev.announcement, [key]: val } } : prev);
  };

  const handleSave = () => {
    if (!config || !adminUser) return;
    const fee = parseFloat(feeInput);
    const updated: PlatformConfig = {
      ...config,
      serviceFeePercent: isNaN(fee) ? 10 : Math.min(Math.max(fee, 0), 50),
    };
    savePlatformConfig(updated);
    setConfig(updated);
    logAuditAction(adminUser, "platform.fee_change",
      `Platform config saved: fee=${updated.serviceFeePercent}%, maintenance=${updated.features.maintenanceMode}`);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const fresh = getPlatformConfig();
    setConfig(fresh);
    setFeeInput(fresh.serviceFeePercent.toString());
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Configuration</h1>
          <p className="text-muted-foreground mt-1">Control fees, feature availability, payment gateways, and announcements.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleSave} className="gap-2 bg-primary">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Service Fee */}
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
            <p className="text-sm text-muted-foreground">Percentage added to every ticket sale as platform revenue. Applied before checkout.</p>
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
                <p className="text-lg font-bold text-emerald-600">+${((parseFloat(feeInput) || 0)).toFixed(2)}</p>
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Changes take effect on new checkout sessions only. Existing sessions are unaffected.</p>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
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
              { key: "maintenanceMode" as const, label: "Maintenance Mode", desc: "Takes the site offline for all non-admin users", danger: true },
              { key: "newRegistrations" as const, label: "New Registrations", desc: "Allow new users to create accounts" },
              { key: "newOrganizerSignups" as const, label: "New Organizer Signups", desc: "Allow organizers to request accounts" },
              { key: "onlinePayments" as const, label: "Online Payments", desc: "Master switch for all payment processing" },
              { key: "stripeEnabled" as const, label: "Stripe Gateway", desc: "Card payments via Stripe" },
              { key: "paynowEnabled" as const, label: "Paynow Gateway", desc: "Zimbabwe payments via Paynow" },
            ] as const).map(f => (
              <div key={f.key} className="flex items-center justify-between py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{f.label}</p>
                    {'danger' in f && f.danger && config.features[f.key] && (
                      <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1.5">ACTIVE</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
                <Switch
                  checked={config.features[f.key]}
                  onCheckedChange={val => setFeature(f.key, val)}
                  className={'danger' in f && f.danger && config.features[f.key] ? "data-[state=checked]:bg-red-500" : ""}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Gateway Status */}
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
                enabled: config.features.stripeEnabled,
                docsUrl: "https://dashboard.stripe.com",
                mode: "Live",
                modeColor: "bg-emerald-100 text-emerald-700",
              },
              {
                name: "Paynow",
                desc: "Zimbabwe local gateway · USD & ZWL",
                enabled: config.features.paynowEnabled,
                docsUrl: "https://www.paynow.co.zw",
                mode: "Live",
                modeColor: "bg-emerald-100 text-emerald-700",
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
                      <Badge className={`text-[10px] px-1.5 border-0 ${gw.modeColor}`}>{gw.mode}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{gw.desc}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => window.open(gw.docsUrl, "_blank")}>
                  Dashboard ↗
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Toggle gateways using Feature Controls above. API keys are managed via Netlify environment variables.</p>
          </CardContent>
        </Card>

        {/* Platform Announcement */}
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
            <p className="text-sm text-muted-foreground">Shows a banner to all site visitors. Use for maintenance notices, promotions, or important updates.</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="ann-active">Show Announcement</Label>
              <Switch
                id="ann-active"
                checked={config.announcement.active}
                onCheckedChange={v => setAnnouncement("active", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={config.announcement.message}
                onChange={e => setAnnouncement("message", e.target.value)}
                placeholder="e.g. We are currently experiencing intermittent issues with Paynow payments. We are working to resolve this."
                rows={3}
                disabled={!config.announcement.active}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={config.announcement.type}
                onValueChange={v => setAnnouncement("type", v)}
                disabled={!config.announcement.active}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info (Blue)</SelectItem>
                  <SelectItem value="warning">Warning (Amber)</SelectItem>
                  <SelectItem value="error">Critical (Red)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.announcement.active && config.announcement.message && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                config.announcement.type === "error" ? "bg-red-50 text-red-800 border border-red-200" :
                config.announcement.type === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                "bg-blue-50 text-blue-800 border border-blue-200"
              }`}>
                <Megaphone className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{config.announcement.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Overview */}
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
                { label: "API Keys", value: "Env-managed", ok: true, note: "Stored in Netlify env vars" },
                { label: "Webhook Signing", value: "Stripe only", ok: true, note: "STRIPE_WEBHOOK_SECRET must be set" },
                { label: "PCI Compliance", value: "Stripe handles", ok: true, note: "No card data touches our servers" },
                { label: "Session Storage", value: "sessionStorage", ok: true, note: "Cleared on browser close" },
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
