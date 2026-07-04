"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  hasImage: boolean;
  image?: string;
}

// Shown only when no admin-managed hero banners are configured yet.
const fallbackSlide: HeroSlide = {
  id: "fallback",
  title: "Zimbabwe's Premier Event Ticketing Platform",
  subtitle: "Discover concerts, comedy, sports, and festivals across Zimbabwe — book your tickets in seconds.",
  ctaText: "Browse Events",
  ctaLink: "/events",
  hasImage: false,
};

export function HeroSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, dragFree: false, containScroll: "trimSnaps" },
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slides, setSlides] = useState<HeroSlide[]>([fallbackSlide]);

  useEffect(() => {
    fetch("/api/banners?type=hero")
      .then((res) => res.json())
      .then((data) => {
        const banners = (data.banners ?? []) as Record<string, unknown>[];
        if (banners.length === 0) return;
        setSlides(
          banners.map((b) => ({
            id: b.id as string,
            title: (b.title as string) || "",
            subtitle: "",
            ctaText: "Learn More",
            ctaLink: (b.link as string) || "/events",
            hasImage: Boolean(b.image),
            image: b.image as string | undefined,
          }))
        );
      })
      .catch(() => {});
  }, []);

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
                {!slide.hasImage && (
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_var(--primary)_1px,_transparent_0)] [background-size:32px_32px]" />
                  </div>
                )}

                <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12 lg:px-8">
                  <div className="max-w-2xl w-full min-w-0">
                    <h1
                      className={cn(
                        "text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl text-balance",
                        slide.hasImage ? "text-white" : "text-foreground"
                      )}
                    >
                      {slide.title}
                    </h1>
                    {slide.subtitle && (
                      <p
                        className={cn(
                          "mt-4 text-base md:text-lg lg:text-xl text-pretty",
                          slide.hasImage ? "text-white/80" : "text-muted-foreground"
                        )}
                      >
                        {slide.subtitle}
                      </p>
                    )}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link href={slide.ctaLink}>
                        <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
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

      {slides.length > 1 && (
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
        </>
      )}
    </section>
  );
}
