import { Shield, Zap, HeadphonesIcon, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Secure Payments",
    description: "All transactions are encrypted and processed by Stripe or Paynow — we never handle your card or wallet details.",
  },
  {
    icon: Zap,
    title: "Instant Tickets",
    description: "Get your QR-coded tickets instantly after payment. No waiting, no hassle.",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description: "Our dedicated team is always here to help with any questions or issues.",
  },
  {
    icon: TrendingUp,
    title: "We Promote Your Events",
    description: "Unlike others, we actively push your events through digital marketing to maximize ticket sales.",
  },
];

export function TrustSection() {
  return (
    <section className="border-y bg-secondary/30 py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Why Choose E-TicketsZW?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            We&apos;re not just a ticketing platform. We&apos;re your partner in making events successful.
          </p>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const stats = [
  { value: "50K+", label: "Tickets Sold" },
  { value: "500+", label: "Events Hosted" },
  { value: "100+", label: "Organizers" },
  { value: "98%", label: "Satisfaction Rate" },
];

export function StatsSection() {
  return (
    <section className="bg-primary py-12 text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-primary-foreground/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
