import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

const posts = [
  {
    id: "1",
    title: "How to Sell Out Your First Event in Zimbabwe",
    excerpt:
      "From marketing to pricing strategy, here&apos;s everything you need to know to fill every seat at your next show.",
    category: "Guide",
    date: "Dec 10, 2024",
    readTime: "5 min read",
  },
  {
    id: "2",
    title: "The Rise of Digital Ticketing in Zimbabwe",
    excerpt:
      "Why more organizers are moving online and how it&apos;s transforming the local events industry.",
    category: "Industry",
    date: "Dec 5, 2024",
    readTime: "4 min read",
  },
  {
    id: "3",
    title: "5 Comedy Shows You Can&apos;t Miss This December",
    excerpt:
      "The holiday season is packed with laughter. Here are our top picks for comedy nights in Harare and Bulawayo.",
    category: "Events",
    date: "Nov 28, 2024",
    readTime: "3 min read",
  },
  {
    id: "4",
    title: "Marathon Training Tips from Zimbabwe&apos;s Best Runners",
    excerpt:
      "Get expert advice on preparing for the Harare Marathon and other upcoming races.",
    category: "Sports",
    date: "Nov 20, 2024",
    readTime: "6 min read",
  },
  {
    id: "5",
    title: "Understanding Ticket Pricing: A Guide for Organizers",
    excerpt:
      "How to price your tickets competitively while maximizing revenue and attendance.",
    category: "Guide",
    date: "Nov 15, 2024",
    readTime: "5 min read",
  },
  {
    id: "6",
    title: "Behind the Scenes: Jah Prayzah Live Setup",
    excerpt:
      "An exclusive look at what it takes to stage one of Zimbabwe&apos;s biggest concerts.",
    category: "Behind the Scenes",
    date: "Nov 10, 2024",
    readTime: "4 min read",
  },
];

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              E-TicketsZW Blog
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Stories, guides, and insights from Zimbabwe&apos;s event community.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="overflow-hidden transition-all hover:shadow-lg"
              >
                <div className="aspect-video bg-gradient-to-br from-primary/20 via-primary/10 to-accent" />
                <CardContent className="p-6">
                  <Badge variant="secondary" className="mb-3">
                    {post.category}
                  </Badge>
                  <h3 className="text-lg font-semibold leading-tight">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readTime}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
