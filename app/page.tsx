import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSlider } from "@/components/home/hero-slider";
import { SearchSection } from "@/components/home/search-section";
import { TrustSection } from "@/components/home/trust-section";
import { EventSections } from "@/components/home/event-sections";
import { AdvertiseCTA } from "@/components/home/section-banner";

export default function HomePage() {
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
        <EventSections />

        {/* Trust Section */}
        <TrustSection />

        {/* Promote Your Event CTA */}
        <AdvertiseCTA />
      </main>

      <Footer />
    </div>
  );
}
