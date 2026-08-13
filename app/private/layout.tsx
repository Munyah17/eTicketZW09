"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { AdminShell, type AdminShellLink } from "@/components/dashboard/admin-shell";
import {
  LayoutDashboard,
  Image,
  Ticket,
  Users,
  DollarSign,
  Settings,
  Tag,
  Crown,
  UserCog,
  CreditCard,
  Settings2,
  HeadphonesIcon,
  Shield,
  ShieldAlert,
  Megaphone,
  Sparkles,
  Activity,
  Wallet,
} from "lucide-react";

// Super Admin's dashboard — deliberately NOT a superset of Admin's
// (/admin/layout.tsx): platform-wide Operations tools plus super-admin-only
// tools (Wallet, Staff, Transactions, Platform Config, Support, Audit, AI
// Insights), but no organizer/creator tooling. Super Admin is a director
// role — hands-on event/organizer operations stay on /admin and /creator.
// See components/dashboard/admin-shell.tsx for the shared shell both
// dashboards render through.
const privateLinks: AdminShellLink[] = [
  { href: "/private", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { href: "/private/events", label: "Events & Markups", icon: Tag, group: "Operations" },
  { href: "/private/tickets", label: "All Tickets", icon: Ticket, group: "Operations" },
  { href: "/private/payments", label: "Payment Verification", icon: ShieldAlert, group: "Operations" },
  { href: "/private/organizers", label: "Organizers", icon: Users, group: "Operations" },
  { href: "/private/banners", label: "Banner Management", icon: Image, group: "Operations" },
  { href: "/private/payouts", label: "Payout Requests", icon: DollarSign, group: "Operations" },
  { href: "/private/users", label: "User Management", icon: UserCog, group: "Operations" },
  { href: "/private/marketing", label: "Marketing", icon: Megaphone, group: "Operations" },
  { href: "/private/system-health", label: "System Health", icon: Activity, group: "Operations" },
  { href: "/private/settings", label: "My Account", icon: Settings, group: "Operations" },
  { href: "/private/wallet", label: "System Wallet", icon: Wallet, group: "Super Admin" },
  { href: "/private/staff", label: "Staff Management", icon: Crown, group: "Super Admin" },
  { href: "/private/transactions", label: "Transactions", icon: CreditCard, group: "Super Admin" },
  { href: "/private/platform", label: "Platform Config", icon: Settings2, group: "Super Admin" },
  { href: "/private/support", label: "Support & Ops", icon: HeadphonesIcon, group: "Super Admin" },
  { href: "/private/audit", label: "Audit Log", icon: Shield, group: "Super Admin" },
  { href: "/private/ai-insights", label: "AI Data Analytics", icon: Sparkles, group: "Super Admin" },
];

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const { isSuperAdmin, isAdmin, isLoggedIn, user, logout } = useAuth();

  // /private/login is a standalone page (its own sign-in form) — never
  // wrapped in the Access-Required/AdminShell chrome below.
  const isPrivateLoginPage = pathname === "/private/login";

  // Anti-enumeration: this portal shouldn't be indexed or discoverable.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // Admin isn't high enough for this dashboard — send them to their own.
  useEffect(() => {
    if (isAdmin && !isSuperAdmin && !isPrivateLoginPage) router.replace("/admin");
  }, [isAdmin, isSuperAdmin, isPrivateLoginPage, router]);

  useEffect(() => {
    if (!isLoggedIn || !isSuperAdmin) return;
    fetch("/api/admin/payouts")
      .then((res) => res.json())
      .then((data) => {
        const payouts = (data.payouts ?? []) as { status: string }[];
        setPendingPayouts(payouts.filter((p) => p.status === "pending").length);
      })
      .catch(() => {});
  }, [isLoggedIn, isSuperAdmin]);

  if (isPrivateLoginPage) {
    return <>{children}</>;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold">Super Admin Access Required</h1>
          <p className="mt-2 text-muted-foreground">Please sign in with a super admin account to continue.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link href="/private/login">
              <Button>Sign In</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin && !isSuperAdmin) {
    return null; // redirecting to /admin
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">You do not have permission to access this area.</p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      links={privateLinks}
      panelLabel="Super Admin"
      panelIcon={Crown}
      dashboardHref="/private"
      settingsHref="/private/settings"
      payoutsHref="/private/payouts"
      pendingPayouts={pendingPayouts}
      user={user}
      logout={logout}
    >
      {children}
    </AdminShell>
  );
}
