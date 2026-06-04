"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Megaphone,
  Calendar,
  DollarSign,
  CheckCircle2,
  Image as ImageIcon,
  Eye,
  TrendingUp,
} from "lucide-react";
import { mockEvents } from "@/lib/mock-data";
import { HERO_BANNER_PRICE_PER_DAY, SECTION_BANNER_PRICE_PER_DAY } from "@/lib/types";

type BannerType = "hero" | "section";

export default function OrganizerAdvertisingPage() {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [bannerType, setBannerType] = useState<BannerType>("hero");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Calculate duration and cost
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const days = calculateDays();
  const totalCost = days * (bannerType === "hero" ? HERO_BANNER_PRICE_PER_DAY : SECTION_BANNER_PRICE_PER_DAY);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="mt-4 text-2xl font-bold">Banner Booked!</h2>
            <p className="mt-2 text-muted-foreground">
              Your banner campaign has been submitted for review. It will go live once approved.
            </p>
            <div className="mt-6 rounded-lg bg-secondary/50 p-4 text-left">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Placement</span>
                  <span className="font-medium">
                    {bannerType === "hero" ? "Hero Slider" : "Section Banner"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-semibold text-primary">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setIsSuccess(false)}
              className="mt-6"
              variant="outline"
            >
              Book Another Banner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Advertise Your Event</h1>
        <p className="text-muted-foreground">
          Boost your event visibility with premium banner placements
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">10K+</p>
              <p className="text-sm text-muted-foreground">Daily Impressions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-success/10 p-3">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">3x</p>
              <p className="text-sm text-muted-foreground">Avg. Sales Boost</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-warning/10 p-3">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">${bannerType === "hero" ? HERO_BANNER_PRICE_PER_DAY : SECTION_BANNER_PRICE_PER_DAY}</p>
              <p className="text-sm text-muted-foreground">Per Day</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Select Event */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Select Event
              </CardTitle>
              <CardDescription>
                Choose which event you want to promote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event to promote" />
                </SelectTrigger>
                <SelectContent>
                  {mockEvents.slice(0, 3).map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Banner Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Banner Placement
              </CardTitle>
              <CardDescription>
                Select where your banner will appear
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={bannerType}
                onValueChange={(value) => setBannerType(value as BannerType)}
                className="grid gap-4 sm:grid-cols-2"
              >
                <Label
                  htmlFor="hero"
                  className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all hover:bg-accent ${
                    bannerType === "hero" ? "border-primary bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="hero" id="hero" />
                      <span className="font-medium">Hero Slider</span>
                    </div>
                    <Badge>Popular</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Premium placement in the main homepage slider
                  </p>
                  <p className="text-sm font-medium text-primary">
                    ${HERO_BANNER_PRICE_PER_DAY}/day - 10K+ impressions
                  </p>
                </Label>

                <Label
                  htmlFor="section"
                  className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all hover:bg-accent ${
                    bannerType === "section" ? "border-primary bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="section" id="section" />
                    <span className="font-medium">Section Banner</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Strategic placement between event categories
                  </p>
                  <p className="text-sm font-medium text-primary">
                    ${SECTION_BANNER_PRICE_PER_DAY}/day - 5K+ impressions
                  </p>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Campaign Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Campaign Duration
              </CardTitle>
              <CardDescription>
                Select when your banner should run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1.5"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1.5"
                    min={startDate || new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              {days > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Campaign duration: <strong>{days} days</strong>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEvent && (
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-sm text-muted-foreground">Event</p>
                    <p className="font-medium">
                      {mockEvents.find((e) => e.id === selectedEvent)?.title}
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placement</span>
                    <span className="font-medium">
                      {bannerType === "hero" ? "Hero Slider" : "Section Banner"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price per day</span>
                    <span className="font-medium">${bannerType === "hero" ? HERO_BANNER_PRICE_PER_DAY : SECTION_BANNER_PRICE_PER_DAY}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary">${totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full gap-2 bg-primary hover:bg-primary/90"
                  onClick={handleSubmit}
                  disabled={!selectedEvent || !startDate || !endDate || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Megaphone className="h-4 w-4" />
                      Book Banner - ${totalCost.toFixed(2)}
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Payment will be processed after review
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
