"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Trash2, Calendar, MapPin, Ticket, DollarSign, Info, Video, Image as ImageIcon, Upload, X, Film } from "lucide-react";
import { EVENT_CATEGORIES, PLATFORM_FEE_PERCENTAGE, Event, EventCategory } from "@/lib/types";
import { saveEvent } from "@/lib/events-store";
import { useAuth } from "@/lib/auth-context";

interface TicketTypeForm {
  id: string;
  name: string;
  description: string;
  price: string;
  quantity: string;
}

export default function CreateEventPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Event Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");

  // Featured Image
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);

  // Promo Video
  const [promoVideoType, setPromoVideoType] = useState<"video" | "slideshow" | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [slideshowImages, setSlideshowImages] = useState<File[]>([]);
  const [slideshowPreviews, setSlideshowPreviews] = useState<string[]>([]);

  // Ticket Types
  const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([
    { id: "1", name: "", description: "", price: "", quantity: "" },
  ]);

  const addTicketType = () => {
    setTicketTypes([
      ...ticketTypes,
      {
        id: Date.now().toString(),
        name: "",
        description: "",
        price: "",
        quantity: "",
      },
    ]);
  };

  const removeTicketType = (id: string) => {
    if (ticketTypes.length > 1) {
      setTicketTypes(ticketTypes.filter((t) => t.id !== id));
    }
  };

  const updateTicketType = (id: string, field: keyof TicketTypeForm, value: string) => {
    setTicketTypes(
      ticketTypes.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleFeaturedImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    // Validate file size (max 20MB)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      alert("Image must be 20MB or smaller");
      return;
    }

    setFeaturedImage(file);
    setFeaturedImagePreview(URL.createObjectURL(file));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 20MB)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      alert("Video must be 20MB or smaller");
      setVideoFile(null);
      setVideoPreview(null);
      return;
    }

    // Validate video duration (max 10 seconds)
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > 10) {
        alert("Video must be 10 seconds or less");
        setVideoFile(null);
        setVideoPreview(null);
        return;
      }
      setVideoDuration(video.duration);
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    };
    video.src = URL.createObjectURL(file);
  };

  const handleSlideshowImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_SIZE = 20 * 1024 * 1024; // 20MB per image
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        alert(`${file.name} is not a valid image`);
        return false;
      }
      if (file.size > MAX_SIZE) {
        alert(`${file.name} is larger than 20MB`);
        return false;
      }
      return true;
    });

    setSlideshowImages((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setSlideshowPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSlideshowImage = (index: number) => {
    setSlideshowImages((prev) => prev.filter((_, i) => i !== index));
    setSlideshowPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearPromoVideo = () => {
    setPromoVideoType(null);
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(0);
    setSlideshowImages([]);
    setSlideshowPreviews([]);
  };

  const handleSubmit = async () => {
    // Validation: Featured image is mandatory
    if (!featuredImage) {
      alert("Featured image is required");
      setIsSubmitting(false);
      return;
    }

    // Validation: Maximum one media type (slideshow OR video, not both)
    const hasVideo = videoFile !== null;
    const hasSlideshow = slideshowImages.length > 0;
    if (hasVideo && hasSlideshow) {
      alert("You can upload either a video OR a slideshow, but not both");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const autoApprove = await fetch("/api/platform-config")
        .then((res) => res.json())
        .then((data) => data.config?.auto_approve_events !== false)
        .catch(() => true);
      const newEvent: Event = {
        id: "", // will be assigned by DB
        title,
        description,
        category: category as EventCategory,
        date,
        time,
        venue,
        city,
        image: "",
        gallery: [],
        organizerId: user?.id || "",
        organizerName: user?.name || "Unknown Organizer",
        organizerCategory: user?.organizerCategory,
        organizerSubtype: user?.organizerSubtype,
        ticketTypes: ticketTypes.map((t) => ({
          id: "", // will be assigned by DB
          name: t.name,
          description: t.description,
          price: parseFloat(t.price),
          currency: "USD" as const,
          quantity: parseInt(t.quantity),
          sold: 0,
        })),
        totalTickets: ticketTypes.reduce((sum, t) => sum + parseInt(t.quantity || "0"), 0),
        soldTickets: 0,
        status: autoApprove ? "published" : "pending_review",
        createdAt: now,
        updatedAt: now,
      };

      const savedEventId = await saveEvent(newEvent);

      // Upload featured image if provided
      if (featuredImage) {
        const formData = new FormData();
        formData.append("image", featuredImage);
        formData.append("eventId", savedEventId);
        try {
          await fetch("/api/organizer/events/image", {
            method: "POST",
            body: formData,
          });
        } catch (err) {
          console.error("Failed to upload featured image:", err);
        }
      }
      router.push(autoApprove ? "/organizer?created=true" : "/organizer?pendingReview=true");
    } catch (err) {
      console.error("Create event failed:", err);
      alert("Failed to create event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid = title && description && category && date && time && venue && city;
  const isStep2Valid = ticketTypes.every(
    (t) => t.name && t.price && t.quantity
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Create New Event</h1>
        <p className="text-muted-foreground">
          Fill in the details below to list your event on E-TicketsZW
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            step >= 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          1
        </div>
        <div className={`h-1 flex-1 rounded ${step >= 2 ? "bg-primary" : "bg-secondary"}`} />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            step >= 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          2
        </div>
        <div className={`h-1 flex-1 rounded ${step >= 3 ? "bg-primary" : "bg-secondary"}`} />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            step >= 3 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          3
        </div>
      </div>

      {/* Step 1: Event Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event Details
            </CardTitle>
            <CardDescription>
              Tell us about your event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Comedy Night with John"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your event, what attendees can expect..."
                className="mt-1.5 min-h-[120px]"
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="venue">Venue *</Label>
                <Input
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g., Harare International Conference Centre"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Harare">Harare</SelectItem>
                    <SelectItem value="Bulawayo">Bulawayo</SelectItem>
                    <SelectItem value="Victoria Falls">Victoria Falls</SelectItem>
                    <SelectItem value="Mutare">Mutare</SelectItem>
                    <SelectItem value="Gweru">Gweru</SelectItem>
                    <SelectItem value="Masvingo">Masvingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Featured Image Section */}
            <div className="space-y-4 rounded-lg border p-4 bg-secondary/50">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Featured Image (Recommended)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload an attractive cover image for your event that will be displayed on event cards
              </p>
              {featuredImagePreview ? (
                <div className="relative">
                  <img
                    src={featuredImagePreview}
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
                <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or WebP (max. 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFeaturedImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Promo Video Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Promo Video (Optional)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Add a promo video to make your event stand out. Choose either a video upload or create a slideshow from your photos.
              </p>

              {!promoVideoType ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setPromoVideoType("video")}
                  >
                    <CardContent className="p-6 text-center">
                      <Video className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <h4 className="font-semibold mb-1">Upload Video</h4>
                      <p className="text-xs text-muted-foreground">Max 30 seconds</p>
                    </CardContent>
                  </Card>

                  <Card
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setPromoVideoType("slideshow")}
                  >
                    <CardContent className="p-6 text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <h4 className="font-semibold mb-1">Create Slideshow</h4>
                      <p className="text-xs text-muted-foreground">Upload photos, max 15 sec video</p>
                    </CardContent>
                  </Card>
                </div>
              ) : promoVideoType === "video" ? (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Upload Video</h4>
                      <Button variant="ghost" size="sm" onClick={clearPromoVideo}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>

                    {videoPreview ? (
                      <div className="space-y-3">
                        <video
                          src={videoPreview}
                          controls
                          className="w-full rounded-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                          Duration: {videoDuration.toFixed(1)}s
                        </p>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium mb-2">Upload your video</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          MP4, WebM, or MOV (max 30 seconds)
                        </p>
                        <Input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoUpload}
                          className="max-w-xs mx-auto"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Create Slideshow</h4>
                      <Button variant="ghost" size="sm" onClick={clearPromoVideo}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {slideshowPreviews.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {slideshowPreviews.map((preview, index) => (
                            <div key={index} className="relative aspect-square">
                              <img
                                src={preview}
                                alt={`Slide ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => removeSlideshowImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <ImageIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium mb-2">Upload photos for slideshow</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          PNG, JPG, or WebP (platform will create a 15-second video)
                        </p>
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleSlideshowImageUpload}
                          className="max-w-xs mx-auto"
                        />
                      </div>

                      {slideshowPreviews.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {slideshowPreviews.length} photo{slideshowPreviews.length !== 1 ? "s" : ""} selected
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="gap-2"
              >
                Continue to Tickets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Ticket Types */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Ticket Types
            </CardTitle>
            <CardDescription>
              Set up your ticket tiers and pricing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Platform Fee Notice */}
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Platform Fee: {PLATFORM_FEE_PERCENTAGE}%</p>
                <p className="text-muted-foreground">
                  E-TicketsZW charges a {PLATFORM_FEE_PERCENTAGE}% service fee on each ticket sale.
                  This covers payment processing, platform maintenance, and marketing support.
                </p>
              </div>
            </div>

            {/* Ticket Types */}
            <div className="space-y-4">
              {ticketTypes.map((ticketType, index) => (
                <div
                  key={ticketType.id}
                  className="rounded-lg border p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Ticket Type {index + 1}</h4>
                    {ticketTypes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTicketType(ticketType.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={ticketType.name}
                        onChange={(e) =>
                          updateTicketType(ticketType.id, "name", e.target.value)
                        }
                        placeholder="e.g., General, VIP, VVIP"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={ticketType.description}
                        onChange={(e) =>
                          updateTicketType(ticketType.id, "description", e.target.value)
                        }
                        placeholder="e.g., Standard seating"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Price (USD) *</Label>
                      <div className="relative mt-1.5">
                        <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          value={ticketType.price}
                          onChange={(e) =>
                            updateTicketType(ticketType.id, "price", e.target.value)
                          }
                          placeholder="0.00"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        value={ticketType.quantity}
                        onChange={(e) =>
                          updateTicketType(ticketType.id, "quantity", e.target.value)
                        }
                        placeholder="100"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  {ticketType.price && (
                    <div className="rounded bg-secondary/50 p-3 text-sm">
                      <p>
                        Buyer pays:{" "}
                        <strong className="font-mono">
                          $
                          {(
                            parseFloat(ticketType.price) *
                            (1 + PLATFORM_FEE_PERCENTAGE / 100)
                          ).toFixed(2)}
                        </strong>
                      </p>
                      <p className="text-muted-foreground font-mono">
                        You receive: ${parseFloat(ticketType.price).toFixed(2)} per
                        ticket
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={addTicketType}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Another Ticket Type
            </Button>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className="flex-1"
              >
                Review & Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Your Event</CardTitle>
            <CardDescription>
              Make sure everything looks correct before publishing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Event Summary */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">
                    {EVENT_CATEGORIES.find((c) => c.value === category)?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Date & Time:</span>
                  <span className="font-medium">
                    {date} at {time}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {venue}, {city}
                  </span>
                </div>
              </div>
            </div>

            {/* Ticket Summary */}
            <div className="space-y-3">
              <h4 className="font-semibold">Ticket Types</h4>
              {ticketTypes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.quantity} tickets available
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">${parseFloat(t.price).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Your price</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Terms */}
            <div className="rounded-lg bg-secondary/50 p-4 text-sm text-muted-foreground">
              <p>
                By publishing this event, you agree to E-TicketsZW&apos;s terms of service
                and acknowledge the {PLATFORM_FEE_PERCENTAGE}% platform fee on all ticket
                sales.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Publishing...
                  </>
                ) : (
                  "Publish Event"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
