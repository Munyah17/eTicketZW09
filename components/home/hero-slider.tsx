"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Ticket, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn, formatCompactNumber } from "@/lib/utils";
import { recordBannerImpression } from "@/lib/banner-impressions";

interface AdSlide {
  id: string;
  title: string;
  link: string;
  image?: string;
  impressions: number;
}

interface HouseSlide {
  id: string;
  badge: string;
  heading: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}

// Always-on platform slides — never purchasable, never empty, so the hero
// keeps rotating even when no advertiser has an active hero banner.
const HOUSE_SLIDES: HouseSlide[] = [
  {
    id: "house-platform",
    badge: "Zimbabwe's Own",
    heading: "Zimbabwe's Premier Event Ticketing Platform",
    body: "Discover concerts, comedy, sports, and festivals across Zimbabwe — book your tickets in seconds.",
    primaryHref: "/events",
    primaryLabel: "Browse Events",
    secondaryHref: "/organizer/create",
    secondaryLabel: "List Your Event",
  },
  {
    id: "house-music-comedy",
    badge: "Live & Loud",
    heading: "Never Miss a Beat — Music & Comedy Nights",
    body: "From stand-up specials to live concerts, find the shows everyone's talking about.",
    primaryHref: "/events?category=music",
    primaryLabel: "Browse Music",
    secondaryHref: "/events?category=comedy",
    secondaryLabel: "Browse Comedy",
  },
  {
    id: "house-sports-festival",
    badge: "Get Moving",
    heading: "From Marathons to Festivals",
    body: "Race day, game day, or festival weekend — find it and get your ticket before it sells out.",
    primaryHref: "/events?category=sports",
    primaryLabel: "Browse Sports",
    secondaryHref: "/events?category=festival",
    secondaryLabel: "Browse Festivals",
  },
  {
    id: "house-organizer",
    badge: "For Organizers",
    heading: "Got an Event? Sell Tickets in Minutes",
    body: "List your event for free and start selling — plus premium banner placement to reach more buyers.",
    primaryHref: "/organizer/create",
    primaryLabel: "List Your Event",
    secondaryHref: "/advertise",
    secondaryLabel: "Advertise With Us",
  },
];

function HouseSlideContent({ slide }: { slide: HouseSlide }) {
  return (
    <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background sm:min-h-[380px] md:min-h-[500px] lg:min-h-[550px]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] animate-[drift_22s_ease-in-out_infinite] motion-reduce:animate-none [background-size:32px_32px] bg-[radial-gradient(circle_at_1px_1px,_var(--primary)_1px,_transparent_0)]"
      />
      <div
        aria-hidden
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-[float-a_14s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-[float-b_18s_ease-in-out_infinite] motion-reduce:animate-none"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 text-center md:py-12 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-mono font-medium uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" />
            {slide.badge}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl lg:text-5xl">
            {slide.heading}
          </h1>
          <p className="mt-4 text-base text-pretty text-muted-foreground md:text-lg lg:text-xl">
            {slide.body}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={slide.primaryHref}>
              <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                <Ticket className="h-4 w-4" />
                {slide.primaryLabel}
              </Button>
            </Link>
            <Link href={slide.secondaryHref}>
              <Button size="lg" variant="outline">
                {slide.secondaryLabel}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, dragFree: false, containScroll: "trimSnaps" },
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [adSlides, setAdSlides] = useState<AdSlide[]>([]);

  useEffect(() => {
    fetch("/api/banners?type=hero")
      .then((res) => res.json())
      .then((data) => {
        const banners = (data.banners ?? []) as Record<string, unknown>[];
        setAdSlides(
          banners
            .filter((b) => b.image)
            .map((b) => ({
              id: b.id as string,
              title: (b.title as string) || "",
              link: (b.link as string) || "/events",
              image: b.image as string | undefined,
              impressions: Number(b.impressions) || 0,
            }))
        );
      })
      .catch(() => {});
  }, []);

  const slideCount = HOUSE_SLIDES.length + adSlides.length;

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Count a view the moment a purchased ad slide is actually brought into frame.
  useEffect(() => {
    const adIndex = selectedIndex - HOUSE_SLIDES.length;
    if (adIndex >= 0 && adSlides[adIndex]) {
      recordBannerImpression(adSlides[adIndex].id);
    }
  }, [selectedIndex, adSlides]);

  return (
    <section className="relative w-full overflow-hidden bg-secondary/30">
      <div ref={emblaRef} className="overflow-hidden touch-pan-y">
        <div className="flex">
          {HOUSE_SLIDES.map((slide) => (
            <div key={slide.id} className="relative min-w-0 flex-[0_0_100%]">
              <HouseSlideContent slide={slide} />
            </div>
          ))}

          {/* Purchased advertiser slides */}
          {adSlides.map((slide) => (
            <div key={slide.id} className="relative min-w-0 flex-[0_0_100%]">
              <div
                className="relative flex min-h-[300px] items-center overflow-hidden bg-foreground/90 sm:min-h-[380px] md:min-h-[500px] lg:min-h-[550px]"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.55) 40%, rgba(15,23,42,0.85) 100%), url(${slide.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12 lg:px-8">
                  <div className="min-w-0 w-full max-w-2xl">
                    <h1 className="text-3xl font-bold tracking-tight text-balance text-white md:text-4xl lg:text-5xl">
                      {slide.title}
                    </h1>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link href={slide.link}>
                        <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                          <Ticket className="h-4 w-4" />
                          Learn More
                        </Button>
                      </Link>
                      <Link href="/events">
                        <Button
                          size="lg"
                          variant="outline"
                          className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                        >
                          Browse All Events
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur">
                  <Eye className="h-3 w-3" />
                  {formatCompactNumber(slide.impressions)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {slideCount > 1 && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex rounded-full bg-background/80 p-2 shadow-lg backdrop-blur transition-all hover:bg-background"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex rounded-full bg-background/80 p-2 shadow-lg backdrop-blur transition-all hover:bg-background"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  selectedIndex === index
                    ? "w-6 bg-primary"
                    : "w-2 bg-background/60 hover:bg-background/80"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
