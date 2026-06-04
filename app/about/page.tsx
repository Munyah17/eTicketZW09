import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Ticket,
  Shield,
  Zap,
  Heart,
  Globe,
  Users,
  Music,
  Trophy,
  Mic2,
  Flag,
} from "lucide-react";

const values = [
  {
    icon: Shield,
    title: "Trust & Security",
    description:
      "Every transaction is secured with bank-grade encryption. We verify all organizers and events before they go live.",
  },
  {
    icon: Zap,
    title: "Speed & Simplicity",
    description:
      "Buy tickets in under 60 seconds. No complicated forms, no hidden fees. Just pick, pay, and go.",
  },
  {
    icon: Heart,
    title: "By Zimbabweans, For Zimbabweans",
    description:
      "Built locally to understand local needs. Pay via Stripe or Paynow — your checkout happens on their secure platform.",
  },
];

const categories = [
  { icon: Mic2, label: "Comedy" },
  { icon: Music, label: "Music" },
  { icon: Trophy, label: "Sports" },
  { icon: Flag, label: "Marathons" },
  { icon: Users, label: "Festivals" },
  { icon: Globe, label: "Conferences" },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-16 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Ticket className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-5xl text-balance">
              Zimbabwe&apos;s Premier Event Ticketing Platform
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
              We don&apos;t just sell tickets — we help your events succeed.
              From comedy nights to marathons, concerts to conferences, we power
              unforgettable experiences across Zimbabwe.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/events">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Browse Events
                </Button>
              </Link>
              <Link href="/organizer/create">
                <Button size="lg" variant="outline">
                  List Your Event
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Our Mission</h2>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              To make event discovery and ticket purchasing effortless for every
              Zimbabwean, while giving event organizers the tools they need to grow
              their audience and maximize their revenue.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold md:text-3xl">Why E-TicketsZW?</h2>
            </div>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {values.map((value) => (
                <Card key={value.title} className="text-center">
                  <CardContent className="pt-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <value.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 font-semibold">{value.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              Events We Power
            </h2>
            <p className="mt-2 text-muted-foreground">
              Every type of event, all in one place
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {categories.map((cat) => (
              <Link
                key={cat.label}
                href={`/events?category=${cat.label.toLowerCase()}`}
              >
                <Card className="text-center transition-all hover:shadow-md">
                  <CardContent className="pt-6">
                    <cat.icon className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-3 font-medium">{cat.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary py-16 text-primary-foreground">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h2 className="text-2xl font-bold md:text-3xl">
              Ready to Host Your Next Event?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/80">
              Join hundreds of organizers who trust E-TicketsZW to power their events.
              Get started in minutes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/organizer/create">
                <Button
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90"
                >
                  Create Event
                </Button>
              </Link>
              <Link href="/advertise">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 text-black hover:bg-primary-foreground/10"
                >
                  Advertise
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
