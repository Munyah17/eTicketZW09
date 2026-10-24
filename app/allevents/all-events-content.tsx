"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { EventCard } from "@/components/events/event-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, X, MapPin } from "lucide-react";
import { EVENT_CATEGORIES, EventCategory, type Event } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SuggestInput } from "@/components/ui/suggest-input";
import { getEventStatusTag } from "@/lib/event-status";

const cities = ["All Cities", "Harare", "Bulawayo", "Victoria Falls", "Mutare", "Gweru"];

export function AllEventsPageContent({ initialEvents }: { initialEvents?: Event[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as EventCategory | null;
  const initialQuery = searchParams.get("q") ?? "";
  const initialCity = searchParams.get("city") ?? "All Cities";

  // SSR'd catalog arrives as initialEvents — first paint already has the
  // grid, no spinner. Falls back to the client fetch when the server
  // couldn't load it.
  const [allEvents, setAllEvents] = useState<Event[]>(initialEvents ?? []);
  const [loading, setLoading] = useState(!initialEvents);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || "all");
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (initialEvents) return;
    // Always newest-posted-first — this page is the flat, ungrouped
    // chronological feed of every listing, not a curated/sorted view.
    fetch("/api/events?sort=newest")
      .then((r) => r.json())
      .then((data) => setAllEvents(data.events ?? []))
      .catch(() => setAllEvents([]))
      .finally(() => setLoading(false));
  }, [initialEvents]);

  const filteredEvents = useMemo(() => {
    let events = allEvents.filter((e) => e.status === "published");

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.venue.toLowerCase().includes(query) ||
          e.organizerName.toLowerCase().includes(query)
      );
    }

    if (selectedCategory && selectedCategory !== "all") {
      events = events.filter((e) => e.category === selectedCategory);
    }

    if (selectedCity !== "All Cities") {
      events = events.filter((e) => e.city === selectedCity);
    }

    // API already returns newest-posted-first; re-sort defensively here too
    // so client-side filtering can never disturb that order.
    return [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allEvents, searchQuery, selectedCategory, selectedCity]);

  const activeFiltersCount = [
    selectedCategory !== "all" ? 1 : 0,
    selectedCity !== "All Cities" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setSelectedCategory("all");
    setSelectedCity("All Cities");
    setSearchQuery("");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="border-b bg-secondary/30 py-8">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <h1 className="text-3xl font-bold md:text-4xl">All Events</h1>
            <p className="mt-2 text-muted-foreground">
              Every event ever listed on E-TicketsZW — newest first
            </p>

            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
              <SuggestInput
                className="relative flex-1"
                value={searchQuery}
                onChange={setSearchQuery}
                suggestions={
                  searchQuery.trim()
                    ? allEvents
                        .filter((e) => e.status === "published")
                        .filter((e) =>
                          [e.title, e.venue, e.organizerName].some((f) =>
                            f?.toLowerCase().includes(searchQuery.trim().toLowerCase())
                          )
                        )
                    : []
                }
                getKey={(e) => e.id}
                getLabel={(e) => e.title}
                onSelect={(e) => router.push(`/events/${e.id}`)}
                placeholder="Search events, venues, organizers..."
                inputClassName="pl-10"
                icon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />}
                renderSuggestion={(e) => (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{e.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{e.venue}, {e.city}</span>
                  </span>
                )}
              />
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={cn("gap-2", showFilters && "bg-accent")}
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border bg-background p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="City" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-3 w-3" />
                    Clear all
                  </Button>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className={selectedCategory === "all" ? "bg-primary hover:bg-primary/90" : ""}
              >
                All
              </Button>
              {EVENT_CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.value)}
                  className={selectedCategory === cat.value ? "bg-primary hover:bg-primary/90" : ""}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Full chronological feed — no pagination, the list simply grows
            (and the scrollbar with it) as more events get listed. */}
        <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <p className="mb-4 text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredEvents.length}</span> of{" "}
            <span className="font-medium text-foreground">{allEvents.filter((e) => e.status === "published").length}</span> events
          </p>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-muted-foreground">Loading events…</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No events found</h3>
              <p className="mt-2 text-muted-foreground">
                Try adjusting your filters or search query
              </p>
              <Button onClick={clearFilters} className="mt-4" variant="outline">
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} statusTag={getEventStatusTag(event)} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
