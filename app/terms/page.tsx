import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Terms of Service | E-TicketsZW",
  description: "Terms of Service for E-TicketsZW, Zimbabwe's event ticketing platform.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 4 July 2026</p>

          <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground/90 dark:prose-invert">
            <section>
              <h2 className="text-lg font-semibold">1. Who we are</h2>
              <p>
                E-TicketsZW (&quot;E-TicketsZW&quot;, &quot;we&quot;, &quot;us&quot;) operates an online event
                ticketing platform connecting event organizers in Zimbabwe with the public. Our registered
                office is Office C3, Cyrus Building, Corner Mbuya Nehanda and Speke, Harare, Zimbabwe.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Accounts</h2>
              <p>
                You must provide accurate information when creating an account and are responsible for
                keeping your login credentials confidential. You must be at least 18 years old, or have the
                permission of a parent or guardian, to create an account or purchase tickets.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Buying tickets</h2>
              <p>
                Tickets are sold by the event organizer; E-TicketsZW acts as the ticketing platform and
                payment facilitator. All card and mobile money payments are processed directly by Stripe or
                Paynow on their own secure, hosted checkout pages — E-TicketsZW never collects, sees, or
                stores your card number, mobile money PIN, or other payment credentials.
              </p>
              <p>
                A platform service fee (currently {" "}
                <strong>10%</strong>) is added to ticket prices to cover payment processing and platform
                costs. The final price is always shown before you pay.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Organizers</h2>
              <p>
                Organizers are solely responsible for the accuracy of their event listings, for delivering
                the event as advertised, and for complying with all applicable laws (including venue permits,
                copyright for performances, and consumer protection). E-TicketsZW may verify, suspend, or
                remove any organizer or event listing at its discretion, including for suspected fraud.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Refunds and cancellations</h2>
              <p>
                Refunds are governed by our{" "}
                <Link href="/refund-policy" className="text-primary underline underline-offset-2">
                  Refund Policy
                </Link>
                , which forms part of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Prohibited conduct</h2>
              <p>
                You may not use the platform to defraud buyers or organizers, resell tickets above the price
                permitted by the organizer, upload unlawful or infringing content, or interfere with the
                security or normal operation of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Liability</h2>
              <p>
                E-TicketsZW provides the platform on an &quot;as is&quot; basis. To the maximum extent
                permitted by law, E-TicketsZW is not liable for losses arising from an event being cancelled,
                postponed, or changed by its organizer, or for payment issues arising on Stripe&apos;s or
                Paynow&apos;s own systems.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Governing law</h2>
              <p>These Terms are governed by the laws of Zimbabwe.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Contact</h2>
              <p>
                Questions about these Terms can be sent to{" "}
                <a href="mailto:support@eticket.co.zw" className="text-primary underline underline-offset-2">
                  support@eticket.co.zw
                </a>{" "}
                or +263 773 909 307.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
