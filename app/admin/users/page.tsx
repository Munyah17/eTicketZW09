"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  User, Search, Plus, Trash2, UserX, UserCheck,
  RefreshCw, Users, AlertTriangle, Briefcase,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { User as UserType, UserRole } from "@/lib/types";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, inDateRange } from "@/components/ui/date-range-filter";
import type { ExportColumn } from "@/lib/export-utils";

const ROLE_COLORS: Record<string, string> = {
  organizer: "bg-purple-100 text-purple-800 border-purple-200",
  staff: "bg-cyan-100 text-cyan-800 border-cyan-200",
  customer: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function UsersPage() {
  const { user: adminUser } = useAuth();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserType | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ user: UserType; newRole: UserRole } | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"organizer" | "customer" | "staff">("customer");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      const rows = (json.users ?? []) as Record<string, unknown>[];
      const mapped: UserType[] = rows.map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "",
        email: (r.email as string) ?? "",
        phone: (r.phone as string) ?? "",
        role: (r.role as UserRole) ?? "customer",
        verified: (r.verified as boolean) ?? false,
        isSuspended: Boolean(r.is_suspended),
        createdAt: (r.created_at as string) ?? "",
        organizerId: (r.organizer_id as string | undefined),
      }));
      setUsers(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole =
      filterRole === "all" ? true :
      filterRole === "suspended" ? u.isSuspended :
      u.role === filterRole;
    return matchSearch && matchRole && inDateRange(u.createdAt, dateFrom, dateTo);
  });

  const exportColumns: ExportColumn<UserType>[] = [
    { header: "Name", accessor: (u) => u.name },
    { header: "Email", accessor: (u) => u.email },
    { header: "Phone", accessor: (u) => u.phone },
    { header: "Role", accessor: (u) => u.role },
    { header: "Verified", accessor: (u) => (u.verified ? "Yes" : "No") },
    { header: "Suspended", accessor: (u) => (u.isSuspended ? "Yes" : "No") },
    { header: "Joined", accessor: (u) => u.createdAt },
  ];

  const handleSuspend = async (u: UserType) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, is_suspended: !u.isSuspended }),
    });
    reload();
  };

  const handleDelete = async (u: UserType) => {
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    setConfirmDelete(null);
    reload();
  };

  const handleRoleChange = async (u: UserType, role: UserRole) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, role }),
    });
    setConfirmRole(null);
    reload();
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!newName || !newEmail || !newPassword) {
      setCreateError("Name, email and password are required."); return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, name: newName.trim(), role: newRole, phone: newPhone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error ?? "Failed to create user"); return; }
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
      reload();
    } finally {
      setCreating(false);
    }
  };

  const counts = {
    total: users.length,
    organizers: users.filter(u => u.role === "organizer").length,
    customers: users.filter(u => u.role === "customer").length,
    staff: users.filter(u => u.role === "staff").length,
    suspended: users.filter(u => u.isSuspended).length,
  };

  if (!adminUser) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage organizer, staff, and customer accounts.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary">
          <Plus className="h-4 w-4" /> Create Account
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={counts.total} icon={Users} iconClassName="bg-primary/10 text-primary" />
        <StatCard label="Organizers" value={counts.organizers} icon={Briefcase} iconClassName="bg-purple-50 text-purple-600" valueClassName="text-purple-600" />
        <StatCard label="Customers" value={counts.customers} icon={User} iconClassName="bg-gray-100 text-gray-600" valueClassName="text-gray-600" />
        <StatCard label="Suspended" value={counts.suspended} icon={UserX} iconClassName="bg-red-50 text-red-600" valueClassName="text-red-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="organizer">Organizer</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <ExportMenu rows={filtered} columns={exportColumns} filename="users" title="Users" />
        <Button variant="ghost" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Users Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No users found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter</p>
              </div>
            )}
            {!loading && filtered.map(u => (
              <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors ${u.isSuspended ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold bg-primary/10 text-primary">
                    {u.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{u.name}</p>
                      {u.isSuspended && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.phone || "—"} · Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="sm:w-32 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${ROLE_COLORS[u.role] || "bg-gray-100"}`}>
                    <User className="h-3 w-3" /> {u.role}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  <Button
                    size="sm" variant="ghost"
                    className={u.isSuspended ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"}
                    onClick={() => handleSuspend(u)}
                    title={u.isSuspended ? "Activate" : "Suspend"}
                  >
                    {u.isSuspended ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                    <span className="ml-1 text-xs hidden sm:inline">{u.isSuspended ? "Activate" : "Suspend"}</span>
                  </Button>

                  <Select
                    value={u.role}
                    onValueChange={(role) => setConfirmRole({ user: u, newRole: role as UserRole })}
                  >
                    <SelectTrigger className="data-[size=default]:h-8 text-xs w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organizer">Organizer</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(u)} title="Delete user">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Account Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Create Account</DialogTitle>
            <DialogDescription>Creates an organizer, staff, or customer account. Admin accounts are managed under Staff Management.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{createError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+263 7X XXX XXXX" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as "organizer" | "customer" | "staff")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-primary">
              {creating ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Delete User</DialogTitle>
            <DialogDescription>This cannot be undone. The user and all their data will be permanently removed.</DialogDescription>
          </DialogHeader>
          {confirmDelete && (
            <div className="py-2">
              <p className="text-sm font-medium">{confirmDelete.name}</p>
              <p className="text-xs text-muted-foreground">{confirmDelete.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Role Change */}
      <Dialog open={!!confirmRole} onOpenChange={() => setConfirmRole(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Change <strong>{confirmRole?.user.name}</strong> from <strong>{confirmRole?.user.role}</strong> to <strong>{confirmRole?.newRole}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRole(null)}>Cancel</Button>
            <Button onClick={() => confirmRole && handleRoleChange(confirmRole.user, confirmRole.newRole)} className="bg-primary">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
