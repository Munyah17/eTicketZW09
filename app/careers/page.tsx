import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, ArrowRight } from "lucide-react";

const openings = [
  {
    title: "Full-Stack Developer",
    department: "Engineering",
    location: "Harare / Remote",
    type: "Full-time",
  },
  {
    title: "Customer Success Manager",
    department: "Operations",
    location: "Harare",
    type: "Full-time",
  },
  {
    title: "Marketing Specialist",
    department: "Growth",
    location: "Harare / Remote",
    type: "Full-time",
  },
  {
    title: "Event Operations Coordinator",
    department: "Operations",
    location: "Harare",
    type: "Contract",
  },
];

export default function CareersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-16 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl text-balance">
              Join the Team
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Help us build the future of event ticketing in Zimbabwe. We&apos;re
              always looking for talented people who are passionate about events
              and technology.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
          <h2 className="text-2xl font-bold">Open Positions</h2>
          <p className="mt-2 text-muted-foreground">
            Come build with us — all roles are based in Harare unless noted.
          </p>

          <div className="mt-8 space-y-4">
            {openings.map((job) => (
              <Card key={job.title} className="transition-all hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{job.department}</Badge>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {job.type}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" className="gap-1 shrink-0">
                    Apply <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-secondary/30 py-16">
          <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
            <h2 className="text-2xl font-bold">Don&apos;t see a fit?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              We&apos;re always interested in meeting great people. Send us your CV
              and tell us what you&apos;d love to work on.
            </p>
            <Link href="/contact">
              <Button className="mt-6 bg-primary hover:bg-primary/90">
                Get in Touch
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
