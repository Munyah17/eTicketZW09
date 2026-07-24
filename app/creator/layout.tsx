"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  BarChart3,
  Settings,
  Plus,
  Megaphone,
  CreditCard,
  Menu,
  X,
  ChevronLeft,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const baseSidebarItems = [
  { name: "Dashboard", href: "/creator", icon: LayoutDashboard },
  { name: "My Events", href: "/creator/events", icon: Calendar },
  { name: "Ticket Sales", href: "/creator/sales", icon: Ticket },
  { name: "Analytics", href: "/creator/analytics", icon: BarChart3 },
  { name: "Advertising", href: "/creator/advertising", icon: Megaphone },
  { name: "Payouts", href: "/creator/payouts", icon: CreditCard },
  { name: "Settings", href: "/creator/settings", icon: Settings },
];

// Service Provider passes are scoped to Super Admin and the owning
// organizer only (not Staff, not regular Admin) — so the nav link is
// conditional rather than living in the shared base list.
const servicePassesItem = { name: "Service Passes", href: "/creator/passes", icon: BadgeCheck };

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoggedIn, isOrganizer, isStaff, isAdmin, isSuperAdmin } = useAuth();

  // Admin/Super Admin have organizing tools merged into their own dashboards
  // (/admin, /super-admin) — they shouldn't land on this separate, simpler
  // shell at all, so a stray link or bookmark sends them to their own portal
  // instead of resurrecting the "two dashboards" problem this replaces.
  useEffect(() => {
    if (isSuperAdmin) router.replace("/super-admin");
    else if (isAdmin) router.replace("/admin");
  }, [isSuperAdmin, isAdmin, router]);

  const canAccessCreator = isOrganizer || isStaff;
  const sidebarItems = isOrganizer ? [...baseSidebarItems, servicePassesItem] : baseSidebarItems;

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold">Creator Access Required</h1>
          <p className="mt-2 text-muted-foreground">
            Please sign in to access the creator dashboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link href="/login">
              <Button>Sign In</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline">Register</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin || isSuperAdmin) {
    return null; // redirecting to their own merged dashboard
  }

  if (!canAccessCreator) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You do not have organizer permissions. Register as an organizer to access this area.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link href="/register?role=organizer">
              <Button>Become an Organizer</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Ticket className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold">
              E-Tickets<span className="text-primary">ZW</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 p-4">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Create Event Button */}
        <div className="border-t p-4">
          <Link href="/creator/create">
            <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        {/* Back to Site */}
        <div className="border-t p-4">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Site
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Creator Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Help
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto overflow-x-hidden p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
