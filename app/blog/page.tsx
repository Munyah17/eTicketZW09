import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Newspaper } from "lucide-react";

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
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Newspaper className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No posts yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              We&apos;re working on our first stories. In the meantime, check out
              the events happening near you.
            </p>
            <Link href="/allevents" className="mt-6">
              <Button variant="outline">Browse Events</Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
