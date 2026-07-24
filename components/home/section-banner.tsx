"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Eye, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCompactNumber } from "@/lib/utils";
import { recordBannerImpression } from "@/lib/banner-impressions";

interface SectionBannerProps {
  position?: number;
}

interface BannerData {
  id: string;
  position: number;
  image?: string;
  link?: string;
  title?: string;
  impressions: number;
}

export function SectionBanner({ position = 1 }: SectionBannerProps) {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/banners?type=section")
      .then((res) => res.json())
      .then((data) => {
        const banners = (data.banners ?? []) as Record<string, unknown>[];
        const match = banners.find((b) => b.position === position);
        if (match) {
          setBanner({
            id: match.id as string,
            position: match.position as number,
            image: match.image as string | undefined,
            link: match.link as string | undefined,
            title: match.title as string | undefined,
            impressions: Number(match.impressions) || 0,
          });
        }
      })
      .catch(() => {});
  }, [position]);

  // Only counts as a marketing impression once the banner actually scrolls
  // into view, not just when it's fetched.
  useEffect(() => {
    if (!banner?.image || !rootRef.current) return;
    const el = rootRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          recordBannerImpression(banner.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [banner?.id, banner?.image]);

  if (!banner || !banner.image) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <Link href="/advertise">
          <div className="group relative flex h-36 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-gradient-to-r from-secondary/50 via-secondary/30 to-secondary/50 transition-all hover:border-primary/30 hover:bg-secondary/70 md:h-48">
            <div className="flex items-center gap-3 text-muted-foreground transition-colors group-hover:text-primary">
              <Megaphone className="h-6 w-6 md:h-8 md:w-8" />
              <div className="text-center">
                <p className="text-lg font-semibold md:text-xl">Advertise Here</p>
                <p className="text-xs md:text-sm">Reach thousands of event-goers - $10/day</p>
              </div>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </section>
    );
  }

  return (
    <section ref={rootRef} className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <Link href={banner.link || "#"}>
        <div className="relative h-36 overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent shadow-sm ring-1 ring-border transition-shadow hover:shadow-md md:h-48">
          <Image
            src={banner.image}
            alt={banner.title || "Advertisement"}
            fill
            className="object-contain"
          />
          <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90 backdrop-blur">
            Sponsored
          </span>
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
            <Eye className="h-3 w-3" />
            {formatCompactNumber(banner.impressions)}
          </span>
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
          Get premium banner placement on our homepage and reach thousands of active ticket buyers across Zimbabwe. Starting at just $10/day.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/advertise">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
              <Megaphone className="h-4 w-4" />
              Start Advertising
            </Button>
          </Link>
          <Link href="/creator/create">
            <Button size="lg" variant="outline">
              List Your Event Free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
