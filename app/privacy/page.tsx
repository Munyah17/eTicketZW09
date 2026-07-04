import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Privacy Policy | E-TicketsZW",
  description: "Privacy Policy for E-TicketsZW, Zimbabwe's event ticketing platform.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 4 July 2026</p>

          <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground/90 dark:prose-invert">
            <section>
              <h2 className="text-lg font-semibold">1. What we collect</h2>
              <p>When you use E-TicketsZW, we collect:</p>
              <ul className="list-disc pl-5">
                <li>Account details: name, email address, phone number, and password (stored hashed, never in plain text).</li>
                <li>Order details: which tickets you bought, for which event, and the amount paid.</li>
                <li>
                  Organizer details, if you register as an organizer: business/company name and payout
                  contact details.
                </li>
                <li>Basic technical data: IP address and device/browser information, for security and fraud prevention.</li>
              </ul>
              <p>
                We do <strong>not</strong> collect or store your card number, CVV, or mobile money PIN.
                Payment is entered directly on Stripe&apos;s or Paynow&apos;s own secure checkout pages.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. How we use it</h2>
              <ul className="list-disc pl-5">
                <li>To create and manage your account, and to issue and email your tickets.</li>
                <li>To process payments through Stripe and Paynow, and to detect and prevent fraud.</li>
                <li>To communicate with you about your orders, and, if you consent, about new events.</li>
                <li>To meet legal and accounting obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Who we share it with</h2>
              <p>We share only what each service needs to do its job:</p>
              <ul className="list-disc pl-5">
                <li><strong>Stripe</strong> and <strong>Paynow</strong> — to process your payment.</li>
                <li><strong>Supabase</strong> — our database and authentication provider, which stores your account and order data.</li>
                <li><strong>Resend</strong> — to deliver your ticket confirmation emails.</li>
                <li><strong>Vercel</strong> — our hosting provider.</li>
                <li>The organizer of the event you bought a ticket for, so they can validate your ticket at the door.</li>
              </ul>
              <p>We do not sell your personal data to third parties.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Your rights</h2>
              <p>
                You can access, correct, or request deletion of your account data at any time by emailing{" "}
                <a href="mailto:support@eticket.co.zw" className="text-primary underline underline-offset-2">
                  support@eticket.co.zw
                </a>
                . We may retain order and payment records for as long as required by tax and accounting law
                even after account deletion.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Security</h2>
              <p>
                Data is stored with encryption in transit and at rest via our infrastructure providers.
                Account access within our own team is role-restricted — most staff can never see or edit
                other staff/administrator accounts.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Changes to this policy</h2>
              <p>We may update this policy from time to time; the &quot;last updated&quot; date above will reflect the latest revision.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Contact</h2>
              <p>
                Office C3, Cyrus Building, Corner Mbuya Nehanda and Speke, Harare, Zimbabwe ·{" "}
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
