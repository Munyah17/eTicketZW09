import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Refund Policy | E-TicketsZW",
  description: "Refund Policy for E-TicketsZW, Zimbabwe's event ticketing platform.",
};

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight">Refund Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 4 July 2026</p>

          <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground/90 dark:prose-invert">
            <section>
              <h2 className="text-lg font-semibold">1. General rule: sales are final</h2>
              <p>
                Ticket purchases are final and non-refundable, except in the situations described below.
                Please double-check the event, date, and ticket type before paying.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. When you are entitled to a refund</h2>
              <ul className="list-disc pl-5">
                <li><strong>Event cancelled</strong> by the organizer — full refund of the ticket price.</li>
                <li>
                  <strong>Event postponed</strong> by the organizer — your ticket is valid for the new date;
                  if you cannot attend the new date, you may request a refund.
                </li>
                <li>
                  <strong>Duplicate or failed charge</strong> — if you were charged more than once for the
                  same order, or charged without a ticket being issued, contact us for a correction.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. How to request a refund</h2>
              <p>
                Email{" "}
                <a href="mailto:support@eticket.co.zw" className="text-primary underline underline-offset-2">
                  support@eticket.co.zw
                </a>{" "}
                with your ticket reference number and the reason for your request. We aim to respond within
                3 business days.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. How refunds are paid</h2>
              <p>
                Approved refunds are returned to the original payment method — your card via Stripe, or your
                mobile money/bank account via Paynow. Processing times depend on your bank or mobile money
                provider and are outside our control; card refunds typically take 5–10 business days,
                Paynow refunds are typically faster.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Platform service fee</h2>
              <p>
                Where a refund is approved due to E-TicketsZW or organizer error (event cancelled, duplicate
                charge), the platform service fee is refunded in full along with the ticket price. Where a
                refund is issued at the organizer&apos;s discretion for another reason, the service fee may
                be non-refundable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Contact</h2>
              <p>
                <a href="mailto:support@eticket.co.zw" className="text-primary underline underline-offset-2">
                  support@eticket.co.zw
                </a>{" "}
                · +263 773 909 307
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
