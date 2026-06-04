"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getActiveBanners } from "@/lib/mock-data";

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  eventDate?: string;
  hasImage: boolean;
  image?: string;
  organizerName?: string;
  status?: string;
}

const defaultSlides: HeroSlide[] = [
  {
    id: "slide-1",
    title: "Ghettocracy Comedy Night 2024",
    subtitle: "Zimbabwe's biggest comedy event returns! Join us for an unforgettable night of laughter.",
    ctaText: "Get Tickets",
    ctaLink: "/events/evt-001",
    eventDate: "December 15, 2024",
    hasImage: true,
    organizerName: "Ghettocracy Entertainment",
  },
  {
    id: "slide-2",
    title: "Jah Prayzah Live in Concert",
    subtitle: "The Military Touch General brings his electrifying performance to Harare.",
    ctaText: "Book Now",
    ctaLink: "/events/evt-003",
    eventDate: "December 22, 2024",
    hasImage: true,
    organizerName: "Military Touch Movement",
  },
  {
    id: "slide-3",
    title: "Harare Marathon 2024",
    subtitle: "Join thousands in Zimbabwe's biggest running event. 5km, 10km, or full marathon.",
    ctaText: "Register Now",
    ctaLink: "/events/evt-002",
    eventDate: "December 8, 2024",
    hasImage: true,
    organizerName: "Zimbabwe Athletics Association",
  },
  {
    id: "advertise-1",
    title: "Advertise Your Event Here",
    subtitle: "Reach thousands of event-goers across Zimbabwe. Premium banner placement for just $20/day.",
    ctaText: "Learn More",
    ctaLink: "/advertise",
    hasImage: false,
  },
];

export function HeroSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, dragFree: false, containScroll: "trimSnaps" },
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const heroBanners = getActiveBanners("hero");
  const slides: HeroSlide[] = heroBanners.length
    ? heroBanners.map((banner) => ({
        id: banner.id,
        title: banner.title || `Hero Banner Slot ${banner.position}`,
        subtitle:
          banner.status === "active"
            ? "Premium hero slider placement on the homepage."
            : "This hero slide is available for advertising. Book now to reach thousands of ticket buyers.",
        ctaText: banner.status === "active" ? "Learn More" : "Advertise Now",
        ctaLink: banner.link || "/advertise",
        eventDate: banner.startDate
          ? banner.endDate
            ? `${banner.startDate} - ${banner.endDate}`
            : `Live from ${banner.startDate}`
          : undefined,
        hasImage: Boolean(banner.image),
        image: banner.image,
        organizerName: banner.organizerId,
        status: banner.status,
      }))
    : defaultSlides;

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
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="relative w-full overflow-hidden bg-secondary/30">
      <div ref={emblaRef} className="overflow-hidden touch-pan-y">
        <div className="flex">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="relative min-w-0 flex-[0_0_100%]"
            >
              <div
                className={cn(
                  "relative flex min-h-[300px] items-center sm:min-h-[380px] md:min-h-[500px] lg:min-h-[550px] overflow-hidden",
                  slide.hasImage
                    ? "bg-foreground/90"
                    : "bg-gradient-to-br from-primary/10 via-primary/5 to-background"
                )}
                style={
                  slide.hasImage
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.55) 40%, rgba(15,23,42,0.85) 100%), url(${slide.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {/* Background pattern for advertise slides */}
                {!slide.hasImage && (
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_var(--primary)_1px,_transparent_0)] [background-size:32px_32px]" />
                  </div>
                )}

                <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12 lg:px-8">
                  <div className="max-w-2xl w-full min-w-0">
                    {slide.organizerName && (
                      <span className="mb-2 inline-block rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary-foreground md:text-sm">
                        {slide.organizerName}
                      </span>
                    )}
                    <h1
                      className={cn(
                        "text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl text-balance",
                        slide.hasImage ? "text-white" : "text-foreground"
                      )}
                    >
                      {slide.title}
                    </h1>
                    <p
                      className={cn(
                        "mt-4 text-base md:text-lg lg:text-xl text-pretty",
                        slide.hasImage ? "text-white/80" : "text-muted-foreground"
                      )}
                    >
                      {slide.subtitle}
                    </p>
                    {slide.eventDate && (
                      <p
                        className={cn(
                          "mt-3 text-sm font-medium md:text-base",
                          slide.hasImage ? "text-white/90" : "text-foreground"
                        )}
                      >
                        {slide.eventDate}
                      </p>
                    )}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link href={slide.ctaLink}>
                        <Button
                          size="lg"
                          className={cn(
                            "gap-2",
                            slide.hasImage
                              ? "bg-primary hover:bg-primary/90"
                              : "bg-primary hover:bg-primary/90"
                          )}
                        >
                          <Ticket className="h-4 w-4" />
                          {slide.ctaText}
                        </Button>
                      </Link>
                      {slide.hasImage && (
                        <Link href="/events">
                          <Button
                            size="lg"
                            variant="outline"
                            className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                          >
                            Browse All Events
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows — hidden on mobile, visible md+ */}
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

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {slides.map((_, index) => (
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
    </section>
  );
}
