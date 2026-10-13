"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert, Crown, KeyRound, UserPlus, Trash2, ArrowDownCircle } from "lucide-react";

interface SuperAdminAccount {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  created_at: string;
  isOwner: boolean;
  last_sign_in_at: string | null;
  totp_enrolled: boolean;
}

const DEMOTE_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "organizer", label: "Organizer" },
  { value: "staff", label: "Staff" },
  { value: "customer", label: "Customer" },
];

export default function SuperAdminsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState<SuperAdminAccount | null>(null);
  const [demoteRole, setDemoteRole] = useState("admin");
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminAccount | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/accounts");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setAccounts(json.accounts ?? []);
    else setError(json.error || "Failed to load Super Admin accounts");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const callApi = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/super-admin/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error || "Action failed");
    else setError("");
    return res.ok;
  };

  const handlePromote = async () => {
    setPromoting(true);
    if (await callApi("POST", { email: promoteEmail })) setPromoteEmail("");
    setPromoting(false);
    load();
  };

  const handleDemote = async () => {
    if (!demoteTarget) return;
    setActing(true);
    if (await callApi("PATCH", { userId: demoteTarget.id, role: demoteRole })) setDemoteTarget(null);
    setActing(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActing(true);
    if (await callApi("DELETE", { userId: deleteTarget.id })) setDeleteTarget(null);
    setActing(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Super Admins</h1>
        <p className="text-muted-foreground mt-1">
          The highest-privilege accounts on the platform — every action here is audited and requires two-factor.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" /> Accounts with Super Admin access
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => {
                  const isSelf = a.id === user?.id;
                  const protectedRow = a.isOwner || isSelf;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.name || a.email}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">
                        {a.last_sign_in_at ? new Date(a.last_sign_in_at).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          {a.isOwner && <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Owner</Badge>}
                          {isSelf && <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">You</Badge>}
                          <Badge className={`border-0 text-xs ${a.totp_enrolled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {a.totp_enrolled ? "2FA on" : "2FA missing"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!protectedRow ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setDemoteTarget(a)}>
                              <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> Demote
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteTarget(a)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Protected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Promote an existing account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              A Super Admin gets <strong>full platform control</strong> — config, money, accounts, everything.
              They must also set up two-factor on their next sign-in before the portal lets them in.
            </p>
          </div>
          <div className="flex gap-2 max-w-lg">
            <div className="flex-1">
              <Label htmlFor="promote-email" className="sr-only">Account email</Label>
              <Input
                id="promote-email"
                type="email"
                placeholder="email of the existing account"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
              />
            </div>
            <Button onClick={handlePromote} disabled={promoting || !promoteEmail.includes("@")}>
              <KeyRound className="h-4 w-4 mr-1" /> {promoting ? "Promoting…" : "Promote"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!demoteTarget} onOpenChange={() => setDemoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote {demoteTarget?.email}?</DialogTitle>
            <DialogDescription>
              They lose all Super Admin access immediately. Their account stays — only the role changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New role</Label>
            <Select value={demoteRole} onValueChange={setDemoteRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEMOTE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDemoteTarget(null)}>Cancel</Button>
            <Button onClick={handleDemote} disabled={acting}>{acting ? "Working…" : "Demote"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete {deleteTarget?.email}?</DialogTitle>
            <DialogDescription>
              The account is permanently removed — auth record, profile, everything. This cannot be undone.
              To revoke access without deleting, demote instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={acting}>
              {acting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
