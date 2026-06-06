import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSlider } from "@/components/home/hero-slider";
import { SearchSection } from "@/components/home/search-section";
import { TrustSection } from "@/components/home/trust-section";
import { EventSections } from "@/components/home/event-sections";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Slider */}
        <HeroSlider />

        {/* Search Section */}
        <SearchSection />

        {/* Trust Section */}
        <TrustSection />

        {/* All Event Sections — client-side, loads from localStorage */}
        <EventSections />
      </main>

      <Footer />
    </div>
  );
}
