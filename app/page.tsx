import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSlider } from "@/components/home/hero-slider";
import { SearchSection } from "@/components/home/search-section";
import { TrustSection } from "@/components/home/trust-section";
import { EventSections } from "@/components/home/event-sections";
import { AdvertiseCTA } from "@/components/home/section-banner";
import { getHomeSections, getBanners } from "@/lib/public-events";
import type { HomeSections, BannerRow } from "@/lib/public-events";

export default async function HomePage() {
  // Server-rendered from the shared cached layer — first paint already has
  // events and banners, no "Loading events…" flash and no 13 separate
  // banner fetches after hydration. On a DB hiccup we pass nothing and the
  // client falls back to fetching /api/events/home itself.
  let sections: HomeSections | undefined;
  let banners: BannerRow[] = [];
  try {
    [sections, banners] = await Promise.all([getHomeSections(), getBanners("section")]);
  } catch {
    sections = undefined;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Slider */}
        <HeroSlider />

        {/* Search Section */}
        <SearchSection />

        {/* All Event Sections — Featured Events leads right after the hero/search,
            ending in the Coming Soon row */}
        <EventSections initialData={sections} banners={banners} />

        {/* Trust Section */}
        <TrustSection />

        {/* Promote Your Event CTA */}
        <AdvertiseCTA />
      </main>

      <Footer />
    </div>
  );
}
