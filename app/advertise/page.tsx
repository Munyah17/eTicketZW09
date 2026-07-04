import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Users,
  TrendingUp,
  Eye,
  CheckCircle2,
  ArrowRight,
  Zap,
  Target,
  BarChart3,
} from "lucide-react";
import { HERO_BANNER_PRICE_PER_DAY, SECTION_BANNER_PRICE_PER_DAY } from "@/lib/types";

const bannerTypes = [
  {
    name: "Hero Slider",
    description: "Premium placement in the main homepage slider. Maximum visibility to all visitors.",
    price: HERO_BANNER_PRICE_PER_DAY,
    impressions: "10,000+ daily",
    position: "Top of homepage",
    features: [
      "Full-width banner",
      "Auto-rotating with other hero slides",
      "Seen by all homepage visitors",
      "1200×400px recommended size",
    ],
  },
  {
    name: "Section Banner",
    description: "Strategic placement between event categories on the homepage.",
    price: SECTION_BANNER_PRICE_PER_DAY,
    impressions: "5,000+ daily",
    position: "Between sections",
    features: [
      "Inline banner placement",
      "Targeted category exposure",
      "970×250px recommended size",
    ],
  },
];

const benefits = [
  {
    icon: Eye,
    title: "Maximum Visibility",
    description: "Your event banner is seen by thousands of active ticket buyers every day.",
  },
  {
    icon: Target,
    title: "Targeted Reach",
    description: "Place your banner near relevant event categories to reach your ideal audience.",
  },
  {
    icon: TrendingUp,
    title: "Boost Sales",
    description: "Events with homepage banners see an average 3x increase in ticket sales.",
  },
  {
    icon: BarChart3,
    title: "Track Performance",
    description: "Monitor impressions, clicks, and conversions in real-time from your dashboard.",
  },
];

const stats = [
  { value: "50K+", label: "Monthly Visitors" },
  { value: "10K+", label: "Daily Impressions" },
  { value: "3x", label: "Avg. Sales Boost" },
  { value: "500+", label: "Events Promoted" },
];

export default function AdvertisePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background py-16 lg:py-24">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_var(--primary)_1px,_transparent_0)] [background-size:32px_32px]" />
          </div>
          <div className="mx-auto max-w-7xl px-4 text-center lg:px-8">
            <Badge className="mb-4 bg-primary/20 text-primary hover:bg-primary/20">
              <Megaphone className="mr-1 h-3 w-3" />
              Advertising
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl text-balance">
              Promote Your Event to<br />Thousands of Ticket Buyers
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
              Get premium banner placement on Zimbabwe&apos;s fastest-growing ticketing platform.
              Starting at just ${SECTION_BANNER_PRICE_PER_DAY}/day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/organizer">
                <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                  <Megaphone className="h-4 w-4" />
                  Start Advertising
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y bg-primary py-10 text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-mono font-bold">{stat.value}</p>
                  <p className="mt-1 text-sm text-primary-foreground/80">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Why Advertise With Us?</h2>
            <p className="mt-2 text-muted-foreground">
              We help you reach the right audience and sell more tickets
            </p>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Banner Types */}
        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold md:text-3xl">Banner Placements</h2>
              <p className="mt-2 text-muted-foreground">
                Choose the placement that works best for your event
              </p>
            </div>
            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              {bannerTypes.map((banner) => (
                <Card
                  key={banner.name}
                  className={banner.name === "Hero Slider" ? "border-primary ring-2 ring-primary" : ""}
                >
                  {banner.name === "Hero Slider" && (
                    <div className="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{banner.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {banner.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-heading font-bold">${banner.price}</span>
                      <span className="text-muted-foreground">/day</span>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <span className="text-muted-foreground">Position</span>
                        <span className="font-medium">{banner.position}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <span className="text-muted-foreground">Est. Impressions</span>
                        <span className="font-medium">{banner.impressions}</span>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {banner.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href="/organizer/advertising" className="block">
                      <Button
                        className={`w-full gap-2 ${
                          banner.name === "Hero Slider"
                            ? "bg-primary hover:bg-primary/90"
                            : ""
                        }`}
                        variant={banner.name === "Hero Slider" ? "default" : "outline"}
                      >
                        Book This Placement
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">How It Works</h2>
            <p className="mt-2 text-muted-foreground">
              Start advertising your event in 3 simple steps
            </p>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="mt-4 font-semibold">Choose Your Placement</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Select between hero slider or section banners based on your goals and budget.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                2
              </div>
              <h3 className="mt-4 font-semibold">Upload Your Banner</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your event banner and select your campaign dates.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="mt-4 font-semibold">Go Live</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete payment and your banner goes live immediately. Track results in real-time.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary py-16 text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 text-center lg:px-8">
            <Zap className="mx-auto h-12 w-12" />
            <h2 className="mt-4 text-2xl font-bold md:text-3xl">
              Ready to Boost Your Ticket Sales?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/80">
              Join hundreds of successful organizers who use E-TicketsZW advertising to sell out their events.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/organizer/advertising">
                <Button
                  size="lg"
                  className="gap-2 bg-background text-foreground hover:bg-background/90"
                >
                  <Megaphone className="h-4 w-4" />
                  Start Advertising
                </Button>
              </Link>
              <Link href="/organizer/create">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  List Event First
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
