"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuggestInput } from "@/components/ui/suggest-input";
import { EVENT_CATEGORIES, type Event } from "@/lib/types";

const cities = ["Harare", "Bulawayo", "Victoria Falls", "Mutare", "Gweru", "Masvingo"];

export function SearchSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("zimbabwe");
  const [city, setCity] = useState("");
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => setEvents((data.events ?? []) as Event[]))
      .catch(() => {});
  }, []);

  const eventSuggestions = searchQuery.trim()
    ? events.filter((e) =>
        [e.title, e.venue, e.organizerName].some((f) =>
          f?.toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
      )
    : [];

  const citySuggestions = city.trim()
    ? cities.filter((c) => c.toLowerCase().includes(city.trim().toLowerCase()))
    : cities;

  const goToEvents = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (category) params.set("category", category);
    if (city) params.set("city", city);
    router.push(`/events?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goToEvents();
  };

  return (
    <section className="bg-gradient-to-b from-primary/5 to-background py-8">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Find Your Next Experience</h2>
          <p className="text-muted-foreground">Search for events, concerts, comedy shows, and more</p>
        </div>

        <form onSubmit={handleSearch} className="bg-background rounded-xl shadow-lg border p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {/* Suggestive search input */}
            <SuggestInput
              className="sm:col-span-2 lg:col-span-2"
              value={searchQuery}
              onChange={setSearchQuery}
              suggestions={eventSuggestions}
              getKey={(e) => e.id}
              getLabel={(e) => e.title}
              onSelect={(e) => router.push(`/events/${e.id}`)}
              onEnter={goToEvents}
              placeholder="Search events, artists, venues..."
              inputClassName="pl-10 h-12"
              icon={<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />}
              renderSuggestion={(e) => (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{e.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{e.venue}, {e.city}</span>
                </span>
              )}
            />

            {/* Country */}
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Country" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zimbabwe">Zimbabwe</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Select */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EVENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* City suggestive search */}
            <SuggestInput
              value={city}
              onChange={setCity}
              suggestions={citySuggestions}
              getKey={(c) => c}
              getLabel={(c) => c}
              onSelect={setCity}
              onEnter={goToEvents}
              placeholder="City, Town, GP, Suburb..."
              inputClassName="pl-10 h-12"
              icon={<MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />}
            />

            <Button type="submit" size="lg" className="h-12 px-6 sm:col-span-2 lg:col-span-1">
              <Search className="h-4 w-4 md:mr-2" />
              <span>Search</span>
            </Button>
          </div>
        </form>

        {/* Quick Category Links */}
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {EVENT_CATEGORIES.slice(0, 6).map((cat) => (
            <Button
              key={cat.value}
              variant="outline"
              size="sm"
              onClick={() => router.push(`/events?category=${cat.value}`)}
              className="rounded-full"
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
