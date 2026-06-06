"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Crown, Shield, User, Search, Plus, Trash2, UserX, UserCheck,
  KeyRound, RefreshCw, Users, AlertTriangle,
} from "lucide-react";
import {
  demoUsers, getRegisteredUsers, saveRegisteredUser, isSuperAdminAccount, SUPER_ADMIN_EMAIL,
} from "@/lib/auth-context";
import { useAuth } from "@/lib/auth-context";
import { logAuditAction } from "@/lib/audit-logger";
import { User as UserType, UserRole } from "@/lib/types";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-yellow-100 text-yellow-800 border-yellow-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  organizer: "bg-purple-100 text-purple-800 border-purple-200",
  staff: "bg-cyan-100 text-cyan-800 border-cyan-200",
  customer: "bg-gray-100 text-gray-700 border-gray-200",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  super_admin: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  organizer: <User className="h-3 w-3" />,
  staff: <User className="h-3 w-3" />,
  customer: <User className="h-3 w-3" />,
};

const SUSPENDED_KEY = "eticket_suspended_users";

function getSuspendedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const d = localStorage.getItem(SUSPENDED_KEY);
    return new Set(d ? JSON.parse(d) : []);
  } catch { return new Set(); }
}

function toggleSuspend(id: string): void {
  const ids = getSuspendedIds();
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  localStorage.setItem(SUSPENDED_KEY, JSON.stringify([...ids]));
}

export default function UsersPage() {
  const { user: adminUser, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [users, setUsers] = useState<UserType[]>([]);
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserType | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ user: UserType; newRole: UserRole } | null>(null);

  // Create admin form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "organizer">("admin");
  const [createError, setCreateError] = useState("");

  const reload = () => {
    const demo = Object.values(demoUsers);
    const registered = getRegisteredUsers();
    const merged = [
      ...demo,
      ...registered.filter(r => !demo.find(d => d.email === r.email)),
    ];
    setUsers(merged);
    setSuspendedIds(getSuspendedIds());
  };

  useEffect(() => { reload(); }, []);

  const filtered = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchSuspended = filterRole === "suspended" ? suspendedIds.has(u.id) : true;
    if (filterRole === "suspended") return matchSearch && matchSuspended;
    return matchSearch && matchRole;
  });

  const handleSuspend = (u: UserType) => {
    if (!adminUser) return;
    toggleSuspend(u.id);
    const wasSuspended = suspendedIds.has(u.id);
    logAuditAction(adminUser, wasSuspended ? "user.activate" : "user.suspend",
      `${wasSuspended ? "Activated" : "Suspended"} user ${u.email}`, u.id);
    reload();
  };

  const handleDelete = (u: UserType) => {
    if (!adminUser) return;
    const registered = getRegisteredUsers().filter(r => r.id !== u.id);
    localStorage.setItem("eticket_registered_users", JSON.stringify(registered));
    logAuditAction(adminUser, "user.delete", `Deleted user ${u.email}`, u.id);
    setConfirmDelete(null);
    reload();
  };

  const handleRoleChange = (u: UserType, role: UserRole) => {
    if (!adminUser) return;
    const updated = { ...u, role };
    saveRegisteredUser(updated);
    logAuditAction(adminUser, "user.role_change",
      `Changed ${u.email} role from ${u.role} to ${role}`, u.id);
    setConfirmRole(null);
    reload();
  };

  const handlePasswordReset = (u: UserType) => {
    if (!adminUser) return;
    logAuditAction(adminUser, "user.password_reset",
      `Password reset triggered for ${u.email}`, u.id);
    alert(`Password reset notification would be sent to ${u.email}`);
  };

  const handleCreate = () => {
    setCreateError("");
    if (!newName || !newEmail || !newPassword) {
      setCreateError("Name, email and password are required."); return;
    }
    const exists = users.find(u => u.email === newEmail.toLowerCase().trim());
    if (exists) { setCreateError("An account with this email already exists."); return; }
    const newUser: UserType = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim(),
      role: newRole,
      verified: true,
      createdAt: new Date().toISOString(),
      password: newPassword,
    };
    saveRegisteredUser(newUser);
    if (adminUser) logAuditAction(adminUser, "user.create",
      `Created ${newRole} account for ${newEmail}`, newUser.id);
    setShowCreate(false);
    setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
    reload();
  };

  const counts = {
    total: users.length,
    admins: users.filter(u => u.role === "admin" || u.role === "super_admin").length,
    organizers: users.filter(u => u.role === "organizer").length,
    customers: users.filter(u => u.role === "customer").length,
    suspended: suspendedIds.size,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Full control over all platform accounts and roles.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary">
            <Plus className="h-4 w-4" /> Create Admin
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Users", value: counts.total, color: "text-foreground" },
          { label: "Admins", value: counts.admins, color: "text-blue-600" },
          { label: "Organizers", value: counts.organizers, color: "text-purple-600" },
          { label: "Customers", value: counts.customers, color: "text-gray-600" },
          { label: "Suspended", value: counts.suspended, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
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
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="organizer">Organizer</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Users Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No users found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter</p>
              </div>
            )}
            {filtered.map(u => {
              const isSA = isSuperAdminAccount(u);
              const isSuspended = suspendedIds.has(u.id);
              const isDemo = !!Object.values(demoUsers).find(d => d.id === u.id);
              return (
                <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors ${isSuspended ? "opacity-60" : ""}`}>
                  {/* Avatar + Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold
                      ${isSA ? "bg-yellow-100 text-yellow-700" : "bg-primary/10 text-primary"}`}>
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{u.name}</p>
                        {isSA && <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                        {isSuspended && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>}
                        {isDemo && <Badge variant="outline" className="text-[10px] px-1.5 py-0">System</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.phone || "—"} · Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Role badge */}
                  <div className="sm:w-32 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${ROLE_COLORS[u.role] || "bg-gray-100"}`}>
                      {ROLE_ICONS[u.role]} {u.role.replace("_", " ")}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 flex-wrap">
                    {/* Suspend / Activate */}
                    {!isSA && (
                      <Button
                        size="sm" variant="ghost"
                        className={isSuspended ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"}
                        onClick={() => handleSuspend(u)}
                        title={isSuspended ? "Activate" : "Suspend"}
                      >
                        {isSuspended ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                        <span className="ml-1 text-xs hidden sm:inline">{isSuspended ? "Activate" : "Suspend"}</span>
                      </Button>
                    )}

                    {/* Change Role (super admin only, cannot demote SA) */}
                    {isSuperAdmin && !isSA && (
                      <Select
                        value={u.role}
                        onValueChange={(role) => setConfirmRole({ user: u, newRole: role as UserRole })}
                      >
                        <SelectTrigger className="h-8 text-xs w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="organizer">Organizer</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {/* Password Reset */}
                    <Button size="sm" variant="ghost" className="text-primary" onClick={() => handlePasswordReset(u)} title="Reset password">
                      <KeyRound className="h-4 w-4" />
                    </Button>

                    {/* Delete (not SA, not system demo users except admin) */}
                    {isSuperAdmin && !isSA && !isDemo && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(u)} title="Delete user">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-500" /> Create Admin Account</DialogTitle>
            <DialogDescription>New admin accounts are immediately active and can access the admin panel.</DialogDescription>
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
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as "admin" | "organizer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-primary">Create Account</Button>
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
