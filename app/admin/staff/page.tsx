"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Shield, Search, Plus, Trash2, UserX, UserCheck,
  RefreshCw, Users, AlertTriangle, Crown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  isSuspended: boolean;
  createdAt: string;
}

export default function StaffManagementPage() {
  const { isSuperAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      const json = await res.json();
      const rows = (json.staff ?? []) as Record<string, unknown>[];
      setStaff(rows.map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "",
        email: (r.email as string) ?? "",
        phone: (r.phone as string) ?? "",
        isSuspended: Boolean(r.is_suspended),
        createdAt: (r.created_at as string) ?? "",
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Crown className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="font-medium">Super Admin only</p>
        <p className="text-sm text-muted-foreground mt-1">Staff Management is exclusive to the Super Admin account.</p>
      </div>
    );
  }

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = async (s: StaffMember) => {
    await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: s.id, is_suspended: !s.isSuspended }),
    });
    reload();
  };

  const handleDelete = async (s: StaffMember) => {
    await fetch("/api/admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: s.id }),
    });
    setConfirmDelete(null);
    reload();
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!newName || !newEmail || !newPassword) {
      setCreateError("Name, email and password are required."); return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, name: newName.trim(), phone: newPhone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error ?? "Failed to create staff account"); return; }
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
      reload();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-1">
            Admin accounts working for you. Only you, as Super Admin, can create, edit, or remove them.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary">
          <Plus className="h-4 w-4" /> Add Admin
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

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
                <p className="font-medium">No admin accounts yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first staff Admin to help run the platform.</p>
              </div>
            )}
            {!loading && filtered.map((s) => (
              <div key={s.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors ${s.isSuspended ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                    {s.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-100 text-blue-800 border-blue-200">
                        <Shield className="h-3 w-3" /> admin
                      </span>
                      {s.isSuspended && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    <p className="text-xs text-muted-foreground">{s.phone || "—"} · Joined {new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  <Button
                    size="sm" variant="ghost"
                    className={s.isSuspended ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"}
                    onClick={() => handleSuspend(s)}
                    title={s.isSuspended ? "Reactivate" : "Suspend"}
                  >
                    {s.isSuspended ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                    <span className="ml-1 text-xs hidden sm:inline">{s.isSuspended ? "Reactivate" : "Suspend"}</span>
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(s)} title="Remove staff account">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-500" /> Add Admin Staff</DialogTitle>
            <DialogDescription>New Admin accounts are immediately active and can access the operational side of the admin panel.</DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-primary">
              {creating ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Remove Admin</DialogTitle>
            <DialogDescription>This cannot be undone. They will immediately lose all admin panel access.</DialogDescription>
          </DialogHeader>
          {confirmDelete && (
            <div className="py-2">
              <p className="text-sm font-medium">{confirmDelete.name}</p>
              <p className="text-xs text-muted-foreground">{confirmDelete.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Remove Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
