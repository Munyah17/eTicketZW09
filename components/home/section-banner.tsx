"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockBanners } from "@/lib/mock-data";

interface SectionBannerProps {
  position?: number;
}

export function SectionBanner({ position = 1 }: SectionBannerProps) {
  const banner = mockBanners.find(
    (b) => b.type === "section" && b.position === position
  );

  // If no active banner or no image, show "Advertise Here" placeholder
  if (!banner || !banner.image || banner.status === "available") {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <Link href="/advertise">
          <div className="group relative flex h-24 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-gradient-to-r from-secondary/50 via-secondary/30 to-secondary/50 transition-all hover:border-primary/30 hover:bg-secondary/70 md:h-32">
            <div className="flex items-center gap-3 text-muted-foreground transition-colors group-hover:text-primary">
              <Megaphone className="h-6 w-6 md:h-8 md:w-8" />
              <div className="text-center">
                <p className="text-lg font-semibold md:text-xl">Advertise Here</p>
                <p className="text-xs md:text-sm">Reach thousands of event-goers - $20/day</p>
              </div>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Link href={banner.link || "#"}>
        <div className="relative h-24 overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent md:h-32">
          {banner.image && (
            <Image
              src={banner.image}
              alt={banner.title || "Advertisement"}
              fill
              className="object-cover"
            />
          )}
          {!banner.image && banner.title && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-lg font-semibold text-foreground md:text-xl">{banner.title}</p>
            </div>
          )}
        </div>
      </Link>
    </section>
  );
}

export function AdvertiseCTA() {
  return (
    <section className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 py-16">
      <div className="mx-auto max-w-7xl px-4 text-center lg:px-8">
        <Megaphone className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-4 text-2xl font-bold md:text-3xl text-balance">
          Promote Your Event to Thousands
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground text-pretty">
          Get premium banner placement on our homepage and reach thousands of active ticket buyers across Zimbabwe. Starting at just $20/day.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/advertise">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
              <Megaphone className="h-4 w-4" />
              Start Advertising
            </Button>
          </Link>
          <Link href="/organizer/create">
            <Button size="lg" variant="outline">
              List Your Event Free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
