"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

// Notification delivery isn't wired to a backend yet — showing fabricated
// alerts here made every user see the same fake tickets and payouts, which
// is worse than an honest empty state. Ticket/order updates already arrive
// by email and WhatsApp; this page is the placeholder for in-app delivery.
export default function NotificationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your events and tickets
          </p>

          <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No notifications yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Ticket confirmations and event updates are sent to your email and WhatsApp.
              In-app notifications are coming soon.
            </p>
            <Link href="/my-tickets" className="mt-6">
              <Button variant="outline">View My Tickets</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
