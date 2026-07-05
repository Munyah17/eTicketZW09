"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Image,
  Ticket,
  Users,
  DollarSign,
  Settings,
  ChevronLeft,
  Tag,
  Menu,
  X,
  Crown,
  Briefcase,
  LogOut,
  UserCog,
  CreditCard,
  Settings2,
  HeadphonesIcon,
  Shield,
  ShieldAlert,
  Megaphone,
  User,
  Bell,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

const superAdminLinks = [
  // ── Operations ──────────────────────────────
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { href: "/admin/events", label: "Events & Markups", icon: Tag, group: "Operations" },
  { href: "/admin/tickets", label: "All Tickets", icon: Ticket, group: "Operations" },
  { href: "/admin/payments", label: "Payment Verification", icon: ShieldAlert, group: "Operations" },
  { href: "/admin/organizers", label: "Organizers", icon: Users, group: "Operations" },
  { href: "/admin/banners", label: "Banner Management", icon: Image, group: "Operations" },
  { href: "/admin/payouts", label: "Payout Requests", icon: DollarSign, group: "Operations" },
  { href: "/admin/users", label: "User Management", icon: UserCog, group: "Operations" },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone, group: "Operations" },
  { href: "/admin/settings", label: "My Account", icon: Settings, group: "Operations" },
  // ── Super Admin ──────────────────────────────
  { href: "/admin/staff", label: "Staff Management", icon: Crown, group: "Super Admin" },
  { href: "/admin/transactions", label: "Transactions", icon: CreditCard, group: "Super Admin" },
  { href: "/admin/platform", label: "Platform Config", icon: Settings2, group: "Super Admin" },
  { href: "/admin/support", label: "Support & Ops", icon: HeadphonesIcon, group: "Super Admin" },
  { href: "/admin/audit", label: "Audit Log", icon: Shield, group: "Super Admin" },
];

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { href: "/admin/events", label: "Events & Markups", icon: Tag, group: "Operations" },
  { href: "/admin/tickets", label: "All Tickets", icon: Ticket, group: "Operations" },
  { href: "/admin/payments", label: "Payment Verification", icon: ShieldAlert, group: "Operations" },
  { href: "/admin/organizers", label: "Organizers", icon: Users, group: "Operations" },
  { href: "/admin/banners", label: "Banner Management", icon: Image, group: "Operations" },
  { href: "/admin/payouts", label: "Payout Requests", icon: DollarSign, group: "Operations" },
  { href: "/admin/users", label: "User Management", icon: UserCog, group: "Operations" },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone, group: "Operations" },
  { href: "/admin/settings", label: "My Account", icon: Settings, group: "Operations" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const { isSuperAdmin, canAccessAdmin, isLoggedIn, user, logout } = useAuth();

  useEffect(() => {
    if (!isLoggedIn || !canAccessAdmin) return;
    fetch("/api/admin/payouts")
      .then((res) => res.json())
      .then((data) => {
        const payouts = (data.payouts ?? []) as { status: string }[];
        setPendingPayouts(payouts.filter((p) => p.status === "pending").length);
      })
      .catch(() => {});
  }, [isLoggedIn, canAccessAdmin]);

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

  if (!canAccessAdmin) {
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

  const sidebarLinks = isSuperAdmin ? superAdminLinks : adminLinks;
  const panelLabel = isSuperAdmin ? "Super Admin" : "Admin Panel";
  const PanelIcon = isSuperAdmin ? Crown : Briefcase;

  const NavLinks = ({ onNav }: { onNav?: () => void }) => {
    const groups = sidebarLinks.reduce<Record<string, typeof sidebarLinks>>((acc, link) => {
      const g = link.group || "Operations";
      if (!acc[g]) acc[g] = [];
      acc[g].push(link);
      return acc;
    }, {});

    return (
      <>
        {Object.entries(groups).map(([group, links]) => (
          <div key={group} className="mb-2">
            <p className="px-3 text-[10px] font-semibold font-mono uppercase tracking-widest text-slate-500 mb-1">{group}</p>
            {links.map((link) => {
              const isActive = pathname === link.href ||
                (link.href !== "/admin" && pathname.startsWith(link.href));
              const hasBadge = link.href === "/admin/payouts" && pendingPayouts > 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNav}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <link.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                  <span className="flex-1">{link.label}</span>
                  {hasBadge && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {pendingPayouts}
                    </span>
                  )}
                  {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                </Link>
              );
            })}
          </div>
        ))}
      </>
    );
  };

  const UserFooter = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
            {user?.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role.replace("_", " ")}</p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-background">
      {/* Desktop Sidebar - dark management style */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 dark:bg-slate-950">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand */}
          <div className="flex items-center gap-3 h-16 px-5 border-b border-white/10">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <PanelIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-heading font-bold text-white truncate">E-TicketsZW</p>
              <Badge className="h-4 px-1.5 text-[9px] bg-primary/20 text-primary border-0 mt-0.5">
                {panelLabel}
              </Badge>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3">
            <NavLinks />
          </nav>

          {/* Footer */}
          <div className="px-3 pb-3 border-t border-white/10 pt-3">
            <UserFooter />
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-slate-900 border-b border-white/10">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setMobileMenuOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <PanelIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm text-white">{panelLabel}</span>
        </Link>
        {pendingPayouts > 0 ? (
          <Link href="/admin/payouts">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pendingPayouts}
            </span>
          </Link>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-200",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-72 bg-slate-900 shadow-2xl flex flex-col transition-transform duration-200 ease-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <PanelIcon className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm text-white">{panelLabel}</span>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 px-3 py-5 overflow-y-auto">
            <NavLinks onNav={() => setMobileMenuOpen(false)} />
          </nav>
          <div className="px-3 pb-4 border-t border-white/10 pt-4 shrink-0">
            <UserFooter />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 lg:pl-64 pt-14 lg:pt-0 bg-slate-50 dark:bg-background min-h-screen">
        {/* Top bar */}
        <div className="hidden lg:flex h-14 items-center justify-between px-8 bg-white dark:bg-card border-b sticky top-0 z-30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {sidebarLinks.find(l => l.href === pathname || (l.href !== "/admin" && pathname.startsWith(l.href)))?.label || "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
                Back to Site
              </Button>
            </Link>
            {pendingPayouts > 0 && (
              <Link href="/admin/payouts">
                <Badge className="gap-1.5 bg-amber-100 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-200 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {pendingPayouts} payout{pendingPayouts > 1 ? "s" : ""} need action
                </Badge>
              </Link>
            )}
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <span className="text-sm font-medium hidden xl:block">{user.name}</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
