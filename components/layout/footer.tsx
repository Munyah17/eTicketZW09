import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { Logo } from "./logo";

const footerLinks = {
  events: [
    { name: "Comedy", href: "/events?category=comedy" },
    { name: "Sports", href: "/events?category=sports" },
    { name: "Marathons", href: "/events?category=marathon" },
    { name: "Festivals", href: "/events?category=festival" },
  ],
  organizers: [
    { name: "List Your Event", href: "/creator/create" },
    { name: "Dashboard", href: "/creator" },
    { name: "Advertising", href: "/advertise" },
    { name: "Payouts", href: "/creator/payouts" },
  ],
  support: [
    { name: "+263 773 909 307", href: "tel:+263773909307", icon: Phone },
    { name: "support@eticket.co.zw", href: "mailto:support@eticket.co.zw", icon: Mail },
    { name: "Office C3, Cyrus Building, Corner Mbuya Nehanda and Speke, Harare", href: "/contact", icon: MapPin },
  ],
  company: [
    { name: "About Us", href: "/about" },
    { name: "Contact", href: "/contact" },
    { name: "Careers", href: "/careers" },
    { name: "Blog", href: "/blog" },
  ],
};

const paymentMethods = [
  { name: "Stripe", color: "bg-indigo-100 text-indigo-700" },
  { name: "Paynow", color: "bg-green-100 text-green-700" },
  { name: "ePay", color: "bg-sky-100 text-sky-700" },
];

export function Footer() {
  return (
    <footer className="border-t bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center">
              <Logo height={32} />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Zimbabwe&apos;s premier event ticketing platform. We don&apos;t just sell tickets, we help your events succeed.
            </p>
          </div>

          {/* Events Links */}
          <div>
            <h3 className="text-sm font-semibold">Events</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.events.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Organizers Links */}
          <div>
            <h3 className="text-sm font-semibold">For Organizers</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.organizers.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-sm font-semibold">Support</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="flex items-start gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.icon && <link.icon className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{link.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Payment Methods & Copyright */}
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Accepted Payments:</span>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((method) => (
                  <span
                    key={method.name}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${method.color}`}
                  >
                    {method.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm font-mono text-muted-foreground">
              &copy; {new Date().getFullYear()} E-TicketsZW. All rights reserved. Developed &amp; Powered By{" "}
              <a href="https://globalspaceweb.co.zw" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                Globalspaceweb.co.zw
              </a>{" "}
              (+263773 909 307)
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:justify-start font-mono">
            <Link href="/terms" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
