"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Users,
  DollarSign,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Mail,
  Phone,
} from "lucide-react";
import { mockOrganizers, mockEvents } from "@/lib/mock-data";

export default function AdminOrganizersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrganizers = mockOrganizers.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getOrganizerEvents = (organizerId: string) => {
    return mockEvents.filter((e) => e.organizerId === organizerId);
  };

  const totalRevenue = mockOrganizers.reduce((s, o) => s + o.totalRevenue, 0);
  const totalPendingPayout = mockOrganizers.reduce((s, o) => s + o.pendingPayout, 0);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organizers</h1>
        <p className="text-muted-foreground mt-1">Manage event organizers on the platform</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Organizers", value: mockOrganizers.length, icon: Users, accent: "bg-blue-500", light: "bg-blue-50 text-blue-600" },
          { title: "Verified",         value: mockOrganizers.filter(o => o.verified).length, icon: CheckCircle2, accent: "bg-emerald-500", light: "bg-emerald-50 text-emerald-600" },
          { title: "Pending Verify",   value: mockOrganizers.filter(o => !o.verified).length, icon: XCircle, accent: "bg-amber-500", light: "bg-amber-50 text-amber-600" },
          { title: "Platform Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, accent: "bg-violet-500", light: "bg-violet-50 text-violet-600" },
        ].map(s => (
          <Card key={s.title} className="border-0 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${s.accent}`} />
            <CardContent className="p-5 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.title}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.light}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-base">Organizer List</CardTitle>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-6">Organizer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Pending Payout</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No organizers found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrganizers.map((org) => {
                  const events = getOrganizerEvents(org.id);
                  return (
                    <TableRow key={org.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{org.name}</p>
                            <p className="text-xs text-muted-foreground">{org.company}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {org.organizerCategory ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium">{org.organizerCategory}</p>
                            {org.organizerSubtype && (
                              <p className="text-[10px] text-muted-foreground">{org.organizerSubtype}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-36">{org.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {org.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {org.verified ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-amber-100 text-amber-700 border-amber-200 font-medium">
                            <XCircle className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{events.length}</span>
                          <span className="text-xs text-muted-foreground">event{events.length !== 1 ? "s" : ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-sm text-emerald-700">${org.totalRevenue.toLocaleString()}</p>
                      </TableCell>
                      <TableCell>
                        {org.pendingPayout > 0 ? (
                          <p className="font-semibold text-sm text-amber-600">${org.pendingPayout.toLocaleString()}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-primary/5 hover:text-primary">
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredOrganizers.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredOrganizers.length} organizer{filteredOrganizers.length !== 1 ? "s" : ""} shown</span>
              <span>Total pending payouts: <strong className="text-amber-600">${totalPendingPayout.toLocaleString()}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
