"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Save,
  Percent,
  DollarSign,
  Bell,
  Shield,
} from "lucide-react";
import { PLATFORM_FEE_PERCENTAGE, HERO_BANNER_PRICE_PER_DAY, SECTION_BANNER_PRICE_PER_DAY, MINIMUM_PAYOUT, PAYOUT_TRANSACTION_COST_PERCENTAGE } from "@/lib/types";

export default function AdminSettingsPage() {
  const [platformFee, setPlatformFee] = useState(PLATFORM_FEE_PERCENTAGE);
  const [heroBannerPrice, setHeroBannerPrice] = useState(HERO_BANNER_PRICE_PER_DAY);
  const [sectionBannerPrice, setSectionBannerPrice] = useState(SECTION_BANNER_PRICE_PER_DAY);
  const [minPayout, setMinPayout] = useState(MINIMUM_PAYOUT);
  const [payoutCost, setPayoutCost] = useState(PAYOUT_TRANSACTION_COST_PERCENTAGE);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [autoPayout, setAutoPayout] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">
          Manage global platform configuration and fees
        </p>
      </div>

      {/* Fees & Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Fees & Pricing
          </CardTitle>
          <CardDescription>
            Configure platform fees and pricing structures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platformFee">Platform Fee (%)</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="platformFee"
                  type="number"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(Number(e.target.value))}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage added to each ticket sale
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroBannerPrice">Hero Banner Price Per Day (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="heroBannerPrice"
                  type="number"
                  value={heroBannerPrice}
                  onChange={(e) => setHeroBannerPrice(Number(e.target.value))}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Daily rate for hero slider banner advertising
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectionBannerPrice">Section Banner Price Per Day (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sectionBannerPrice"
                  type="number"
                  value={sectionBannerPrice}
                  onChange={(e) => setSectionBannerPrice(Number(e.target.value))}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Daily rate for section banner advertising
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minPayout">Minimum Payout (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="minPayout"
                  type="number"
                  value={minPayout}
                  onChange={(e) => setMinPayout(Number(e.target.value))}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum amount organizers can request for payout
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payoutCost">Payout Transaction Cost (%)</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="payoutCost"
                  type="number"
                  value={payoutCost}
                  onChange={(e) => setPayoutCost(Number(e.target.value))}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage fee deducted from each payout
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure system-wide notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Send email alerts for new events, sales, and payouts
              </p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>SMS Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Send SMS alerts for critical events
              </p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Approve Payouts</Label>
              <p className="text-xs text-muted-foreground">
                Automatically approve payout requests below $500
              </p>
            </div>
            <Switch checked={autoPayout} onCheckedChange={setAutoPayout} />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security & Maintenance
          </CardTitle>
          <CardDescription>
            Platform security and maintenance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Maintenance Mode</Label>
              <p className="text-xs text-muted-foreground">
                Temporarily disable ticket purchases for maintenance
              </p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input id="supportEmail" defaultValue="support@eticket.co.zw" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportPhone">Support Phone</Label>
            <Input id="supportPhone" defaultValue="+263 773 909 307" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
