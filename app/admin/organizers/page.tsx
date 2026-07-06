"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
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
  Mail,
  Phone,
  RefreshCw,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/export-menu";
import type { ExportColumn } from "@/lib/export-utils";

interface OrganizerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  organizer_category: string | null;
  organizer_subtype: string | null;
  verified: boolean;
  event_count: number;
  computed_revenue: number;
  computed_pending_payout: number;
}

export default function AdminOrganizersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizers");
      const json = await res.json();
      setOrganizers(json.organizers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filteredOrganizers = organizers.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportColumns: ExportColumn<OrganizerRow>[] = [
    { header: "Name", accessor: (o) => o.name },
    { header: "Email", accessor: (o) => o.email },
    { header: "Phone", accessor: (o) => o.phone },
    { header: "Company", accessor: (o) => o.company ?? "" },
    { header: "Category", accessor: (o) => o.organizer_category ?? "" },
    { header: "Verified", accessor: (o) => (o.verified ? "Yes" : "No") },
    { header: "Events", accessor: (o) => o.event_count },
    { header: "Revenue", accessor: (o) => o.computed_revenue },
    { header: "Pending Payout", accessor: (o) => o.computed_pending_payout },
  ];

  const toggleVerified = async (org: OrganizerRow) => {
    await fetch("/api/admin/organizers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizerId: org.id, verified: !org.verified }),
    });
    reload();
  };

  const totalRevenue = organizers.reduce((s, o) => s + o.computed_revenue, 0);
  const totalPendingPayout = organizers.reduce((s, o) => s + o.computed_pending_payout, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizers</h1>
          <p className="text-muted-foreground mt-1">Manage event organizers on the platform</p>
        </div>
        <Button variant="outline" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Organizers" value={organizers.length} icon={Users} iconClassName="bg-blue-50 text-blue-600" />
        <StatCard label="Verified" value={organizers.filter(o => o.verified).length} icon={CheckCircle2} iconClassName="bg-emerald-50 text-emerald-600" />
        <StatCard label="Pending Verify" value={organizers.filter(o => !o.verified).length} icon={XCircle} iconClassName="bg-amber-50 text-amber-600" />
        <StatCard label="Platform Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} iconClassName="bg-violet-50 text-violet-600" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-base">Organizer List</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <ExportMenu rows={filteredOrganizers} columns={exportColumns} filename="organizers" title="Organizers" />
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredOrganizers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No organizers found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrganizers.map((org) => (
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
                      {org.organizer_category ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">{org.organizer_category}</p>
                          {org.organizer_subtype && (
                            <p className="text-[10px] text-muted-foreground">{org.organizer_subtype}</p>
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
                        <span className="font-semibold text-sm">{org.event_count}</span>
                        <span className="text-xs text-muted-foreground">event{org.event_count !== 1 ? "s" : ""}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-sm text-emerald-700">${org.computed_revenue.toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      {org.computed_pending_payout > 0 ? (
                        <p className="font-semibold text-sm text-amber-600">${org.computed_pending_payout.toLocaleString()}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost" size="sm"
                        className={`h-7 text-xs gap-1 ${org.verified ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                        onClick={() => toggleVerified(org)}
                      >
                        {org.verified ? "Unverify" : "Verify"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!loading && filteredOrganizers.length > 0 && (
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
