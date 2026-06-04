import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSlider } from "@/components/home/hero-slider";
import { SearchSection } from "@/components/home/search-section";
import { FeaturedSection, CategorySection, UpcomingSection } from "@/components/home/category-section";
import { SectionBanner, AdvertiseCTA } from "@/components/home/section-banner";
import { TrustSection, StatsSection } from "@/components/home/trust-section";
import { getEventsByCategory, getFeaturedEvents, getUpcomingEvents } from "@/lib/mock-data";

export default function HomePage() {
  const featuredEvents = getFeaturedEvents();
  const comedyEvents = getEventsByCategory("comedy");
  const sportsEvents = getEventsByCategory("sports");
  const marathonEvents = getEventsByCategory("marathon");
  const festivalEvents = getEventsByCategory("festival");
  const upcomingEvents = getUpcomingEvents();

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
        
        {/* Featured Events */}
        <FeaturedSection events={featuredEvents} />
        
        {/* Banner Ad Slot 1 */}
        <SectionBanner position={1} />
        
        {/* Comedy Section */}
        <CategorySection category="comedy" events={comedyEvents} />
        
        {/* Banner Ad Slot 2 */}
        <SectionBanner position={2} />
        
        {/* Sports & Marathon Section */}
        <CategorySection category="sports" events={sportsEvents} />
        
        {/* Stats Section */}
        <StatsSection />
        
        {/* Marathon Section */}
        <CategorySection category="marathon" events={marathonEvents} />
        
        {/* Banner Ad Slot 3 */}
        <SectionBanner position={3} />
        
        {/* Festival Section */}
        <CategorySection category="festival" events={festivalEvents} />
        
        {/* Upcoming Events */}
        <UpcomingSection events={upcomingEvents} />
        
        {/* Advertise CTA */}
        <AdvertiseCTA />
      </main>
      
      <Footer />
    </div>
  );
}
