"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Calendar,
  Plus,
  BarChart3,
  UserCircle,
  BadgeCheck,
} from "lucide-react";

// Super Admin's dashboard — a strict superset of Admin's (/admin): every
// Operations tool Admin has, plus organizing tools, plus the super-admin-
// exclusive tools (Wallet, Staff, Transactions, Platform Config, Support,
// Audit, AI Insights). One portal, not several — see /admin/layout.tsx for
// the sibling dashboard and components/dashboard/admin-shell.tsx for the
// shared shell both render through.
const superAdminLinks: AdminShellLink[] = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { href: "/super-admin/events", label: "Events & Markups", icon: Tag, group: "Operations" },
  { href: "/super-admin/tickets", label: "All Tickets", icon: Ticket, group: "Operations" },
  { href: "/super-admin/payments", label: "Payment Verification", icon: ShieldAlert, group: "Operations" },
  { href: "/super-admin/organizers", label: "Organizers", icon: Users, group: "Operations" },
  { href: "/super-admin/banners", label: "Banner Management", icon: Image, group: "Operations" },
  { href: "/super-admin/payouts", label: "Payout Requests", icon: DollarSign, group: "Operations" },
  { href: "/super-admin/users", label: "User Management", icon: UserCog, group: "Operations" },
  { href: "/super-admin/marketing", label: "Marketing", icon: Megaphone, group: "Operations" },
  { href: "/super-admin/system-health", label: "System Health", icon: Activity, group: "Operations" },
  { href: "/super-admin/settings", label: "My Account", icon: Settings, group: "Operations" },
  { href: "/super-admin/my-events-overview", label: "Organizer Overview", icon: LayoutDashboard, group: "Organizing" },
  { href: "/super-admin/my-events", label: "My Events", icon: Calendar, group: "Organizing" },
  { href: "/super-admin/create-event", label: "Create Event", icon: Plus, group: "Organizing" },
  { href: "/super-admin/ticket-sales", label: "Ticket Sales", icon: Ticket, group: "Organizing" },
  { href: "/super-admin/organizer-analytics", label: "Analytics", icon: BarChart3, group: "Organizing" },
  { href: "/super-admin/advertising", label: "Advertising", icon: Megaphone, group: "Organizing" },
  { href: "/super-admin/my-payouts", label: "My Payouts", icon: CreditCard, group: "Organizing" },
  { href: "/super-admin/organizer-staff", label: "My Staff", icon: UserCircle, group: "Organizing" },
  { href: "/super-admin/gate", label: "Gate Management", icon: Shield, group: "Organizing" },
  { href: "/super-admin/service-passes", label: "Service Passes", icon: BadgeCheck, group: "Organizing" },
  { href: "/super-admin/organizer-settings", label: "Organizer Settings", icon: Settings, group: "Organizing" },
  { href: "/super-admin/wallet", label: "System Wallet", icon: Wallet, group: "Super Admin" },
  { href: "/super-admin/staff", label: "Staff Management", icon: Crown, group: "Super Admin" },
  { href: "/super-admin/transactions", label: "Transactions", icon: CreditCard, group: "Super Admin" },
  { href: "/super-admin/platform", label: "Platform Config", icon: Settings2, group: "Super Admin" },
  { href: "/super-admin/support", label: "Support & Ops", icon: HeadphonesIcon, group: "Super Admin" },
  { href: "/super-admin/audit", label: "Audit Log", icon: Shield, group: "Super Admin" },
  { href: "/super-admin/ai-insights", label: "AI Data Analytics", icon: Sparkles, group: "Super Admin" },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const { isSuperAdmin, isAdmin, isLoggedIn, user, logout } = useAuth();

  // Admin isn't high enough for this dashboard — send them to their own.
  useEffect(() => {
    if (isAdmin && !isSuperAdmin) router.replace("/admin");
  }, [isAdmin, isSuperAdmin, router]);

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

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold">Super Admin Access Required</h1>
          <p className="mt-2 text-muted-foreground">Please sign in with a super admin account to continue.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link href="/login">
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
      links={superAdminLinks}
      panelLabel="Super Admin"
      panelIcon={Crown}
      dashboardHref="/super-admin"
      settingsHref="/super-admin/settings"
      payoutsHref="/super-admin/payouts"
      pendingPayouts={pendingPayouts}
      user={user}
      logout={logout}
    >
      {children}
    </AdminShell>
  );
}
