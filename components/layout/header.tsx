"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu, X, Ticket, User, LogOut, LayoutDashboard, Bell, Settings, Shield, Crown, Briefcase, Moon, Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";
import { Logo } from "./logo";

const navigation = [
  { name: "Home", href: "/" },
  { name: "Events", href: "/events" },
  { name: "For Organizers", href: "/organizer" },
  { name: "Advertise", href: "/advertise" },
  { name: "About", href: "/about" },
];

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  organizer: "Organizer",
  staff: "Staff",
  customer: "Customer",
};

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoggedIn, logout, isSuperAdmin, isAdmin, isOrganizer, isStaff, canAccessAdmin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        {/* Mobile: Hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>

        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Logo height={32} />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex lg:items-center lg:gap-x-3">
          {/* Theme Toggle */}
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Toggle dark mode"
            />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>

          {isLoggedIn ? (
            <>
              <Link href="/organizer/create">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  List Your Event
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-2 border-b mb-1">
                    <p className="font-semibold text-sm">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {isSuperAdmin && <Crown className="h-3 w-3" />}
                      {roleLabels[user?.role || "customer"]}
                    </span>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/my-tickets" className="flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      My Tickets
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notifications" className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notifications
                    </Link>
                  </DropdownMenuItem>

                  {/* Organizer / Staff links */}
                  {(isOrganizer || isStaff || isAdmin) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/organizer" className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          Organizer Dashboard
                        </Link>
                      </DropdownMenuItem>
                      {(isOrganizer || isStaff || isSuperAdmin) && (
                        <DropdownMenuItem asChild>
                          <Link href="/organizer/gate" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Gate Management
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  {/* Admin links */}
                  {canAccessAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 text-primary">
                          {isSuperAdmin ? <Crown className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                          {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => {
                      logout();
                      window.location.href = "/login";
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Switch Account
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive cursor-pointer" onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: Theme Toggle + Profile Avatar */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Toggle dark mode"
            />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>

          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b mb-1">
                  <p className="font-semibold text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-tickets" className="flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    My Tickets
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </Link>
                </DropdownMenuItem>
                {(isOrganizer || isStaff || isAdmin) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/organizer" className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Organizer Dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {canAccessAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2 text-primary">
                      <Shield className="h-4 w-4" />
                      {isSuperAdmin ? "Super Admin" : "Admin Panel"}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive cursor-pointer" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Slide-in Sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-300",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Sidebar - solid white background */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-72 bg-background border-r shadow-xl transition-transform duration-300 ease-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <Link href="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
              <Logo height={28} />
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex flex-col p-4 gap-1 bg-background">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="my-4 border-t" />
            {isLoggedIn && (
              <>
                {(isOrganizer || isStaff || isAdmin) && (
                  <>
                    <Link
                      href="/organizer"
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Organizer Dashboard
                    </Link>
                    <Link
                      href="/organizer/gate"
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Shield className="h-4 w-4" />
                      Gate Management
                    </Link>
                  </>
                )}
                {canAccessAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors text-primary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {isSuperAdmin ? <Crown className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                    {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
                  </Link>
                )}
                <div className="my-4 border-t" />
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
                <Link
                  href="/my-tickets"
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Ticket className="h-4 w-4" />
                  My Tickets
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </>
            )}
            <div className="mt-4 px-3">
              <Link href="/organizer/create" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-primary hover:bg-primary/90">
                  List Your Event
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
