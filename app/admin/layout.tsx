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
  Briefcase,
  UserCog,
  Megaphone,
  ShieldAlert,
  Activity,
  Calendar,
  Plus,
  BarChart3,
  CreditCard,
  Shield,
  UserCircle,
} from "lucide-react";

// Admin's own dashboard — the Operations tools it always had, plus
// organizing tools (create/manage events) merged in, so there's no
// separate "Organizer Dashboard" to jump to anymore. Super Admin has its
// own, separate dashboard at /super-admin (redirected there below) with
// everything here plus the super-admin-only tools.
const adminLinks: AdminShellLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { href: "/admin/events", label: "Events & Markups", icon: Tag, group: "Operations" },
  { href: "/admin/tickets", label: "All Tickets", icon: Ticket, group: "Operations" },
  { href: "/admin/payments", label: "Payment Verification", icon: ShieldAlert, group: "Operations" },
  { href: "/admin/organizers", label: "Organizers", icon: Users, group: "Operations" },
  { href: "/admin/banners", label: "Banner Management", icon: Image, group: "Operations" },
  { href: "/admin/payouts", label: "Payout Requests", icon: DollarSign, group: "Operations" },
  { href: "/admin/users", label: "User Management", icon: UserCog, group: "Operations" },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone, group: "Operations" },
  { href: "/admin/system-health", label: "System Health", icon: Activity, group: "Operations" },
  { href: "/admin/settings", label: "My Account", icon: Settings, group: "Operations" },
  { href: "/admin/my-events-overview", label: "Organizer Overview", icon: LayoutDashboard, group: "Organizing" },
  { href: "/admin/my-events", label: "My Events", icon: Calendar, group: "Organizing" },
  { href: "/admin/create-event", label: "Create Event", icon: Plus, group: "Organizing" },
  { href: "/admin/ticket-sales", label: "Ticket Sales", icon: Ticket, group: "Organizing" },
  { href: "/admin/organizer-analytics", label: "Analytics", icon: BarChart3, group: "Organizing" },
  { href: "/admin/advertising", label: "Advertising", icon: Megaphone, group: "Organizing" },
  { href: "/admin/my-payouts", label: "My Payouts", icon: CreditCard, group: "Organizing" },
  { href: "/admin/organizer-staff", label: "My Staff", icon: UserCircle, group: "Organizing" },
  { href: "/admin/gate", label: "Gate Management", icon: Shield, group: "Organizing" },
  { href: "/admin/organizer-settings", label: "Organizer Settings", icon: Settings, group: "Organizing" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const { isSuperAdmin, isAdmin, isLoggedIn, user, logout } = useAuth();

  // Super Admin outranks this dashboard — it has everything here plus
  // super-admin-only tools, at its own URL. Sending them there instead of
  // letting them use the plain Admin dashboard is what keeps this to one
  // portal per person rather than two. Preserving the sub-path (not just
  // bouncing to the dashboard root) means a stale /admin/events link still
  // lands them on the equivalent /super-admin/events page.
  useEffect(() => {
    if (isSuperAdmin) router.replace(pathname.replace(/^\/admin/, "/super-admin"));
  }, [isSuperAdmin, pathname, router]);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    fetch("/api/admin/payouts")
      .then((res) => res.json())
      .then((data) => {
        const payouts = (data.payouts ?? []) as { status: string }[];
        setPendingPayouts(payouts.filter((p) => p.status === "pending").length);
      })
      .catch(() => {});
  }, [isLoggedIn, isAdmin]);

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold">Admin Access Required</h1>
          <p className="mt-2 text-muted-foreground">Please sign in with an admin account to continue.</p>
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

  if (isSuperAdmin) {
    return null; // redirecting to /super-admin
  }

  if (!isAdmin) {
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
      links={adminLinks}
      panelLabel="Admin Panel"
      panelIcon={Briefcase}
      dashboardHref="/admin"
      settingsHref="/admin/settings"
      payoutsHref="/admin/payouts"
      pendingPayouts={pendingPayouts}
      user={user}
      logout={logout}
    >
      {children}
    </AdminShell>
  );
}
