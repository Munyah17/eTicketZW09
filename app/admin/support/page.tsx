"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, User, Ticket, Mail, Phone, Calendar, CheckCircle2,
  XCircle, Clock, HeadphonesIcon, Send, AlertTriangle, RefreshCw,
} from "lucide-react";
import { isSuperAdminAccount } from "@/lib/auth-context";
import { User as UserType, UserRole } from "@/lib/types";

interface SupportTicket {
  id: string;
  name: string;
  email: string;
  type: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  subject: string;
  message: string;
  created_at: string;
}

interface UserTicketRow {
  id: string;
  event_title: string;
  ticket_type_name: string;
  total_paid: number;
  payment_status: string;
  purchased_at: string;
}

const PRIORITY_CONFIG = {
  high: { color: "bg-red-100 text-red-700", label: "High" },
  medium: { color: "bg-amber-100 text-amber-700", label: "Medium" },
  low: { color: "bg-gray-100 text-gray-600", label: "Low" },
};

const STATUS_CONFIG = {
  open: { color: "bg-blue-100 text-blue-700", icon: Clock, label: "Open" },
  in_progress: { color: "bg-purple-100 text-purple-700", icon: RefreshCw, label: "In Progress" },
  resolved: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, label: "Resolved" },
  closed: { color: "bg-gray-100 text-gray-600", icon: XCircle, label: "Closed" },
};

export default function SupportPage() {
  const [userSearch, setUserSearch] = useState("");
  const [foundUser, setFoundUser] = useState<UserType | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userTickets, setUserTickets] = useState<UserTicketRow[]>([]);
  const [showTickets, setShowTickets] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyError, setNotifyError] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [allUsers, setAllUsers] = useState<UserType[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/support");
      const json = await res.json();
      setTickets(json.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(json => {
        const rows = (json.users ?? []) as Record<string, unknown>[];
        setAllUsers(rows.map(r => ({
          id: r.id as string,
          name: (r.name as string) ?? "",
          email: (r.email as string) ?? "",
          phone: (r.phone as string) ?? "",
          role: (r.role as UserRole) ?? "customer",
          verified: (r.verified as boolean) ?? false,
          createdAt: (r.created_at as string) ?? "",
        })));
      })
      .catch(() => {});
  }, []);

  const handleUserLookup = () => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return;
    const found = allUsers.find(u =>
      u.email.toLowerCase() === q ||
      u.name.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
    setFoundUser(found || null);
    setNotFound(!found);
  };

  const loadUserTickets = async (user: UserType) => {
    const res = await fetch(`/api/admin/tickets?search=${encodeURIComponent(user.email)}`);
    const json = await res.json();
    setUserTickets(json.tickets ?? []);
    setShowTickets(true);
  };

  const handleSendNotification = async () => {
    if (!foundUser || !notifyMsg.trim()) return;
    setNotifySending(true);
    setNotifyError("");
    try {
      const res = await fetch("/api/admin/support/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: foundUser.email, toName: foundUser.name, message: notifyMsg }),
      });
      const json = await res.json();
      if (!res.ok) { setNotifyError(json.error ?? "Failed to send"); return; }
      setShowNotify(false);
      setNotifyMsg("");
    } finally {
      setNotifySending(false);
    }
  };

  const handleStatusChange = async (id: string, status: SupportTicket["status"]) => {
    await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: id, status }),
    });
    reload();
  };

  const filteredTickets = filterType === "all"
    ? tickets
    : tickets.filter(t => t.status === filterType || t.type === filterType);

  const openCount = tickets.filter(t => t.status === "open").length;
  const highCount = tickets.filter(t => t.priority === "high" && t.status !== "resolved").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support & Operations</h1>
        <p className="text-muted-foreground mt-1">User lookup, manual overrides, and support ticket management.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Open Tickets", value: openCount, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "High Priority", value: highCount, color: "text-red-600", bg: "bg-red-50" },
          { label: "Resolved", value: resolvedCount, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                <HeadphonesIcon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{s.label}</p>
                <p className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <Search className="h-4 w-4 text-blue-600" />
            </div>
            <CardTitle className="text-base">User Lookup</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Search by email, name, or phone…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleUserLookup()}
              className="flex-1"
            />
            <Button onClick={handleUserLookup} className="bg-primary gap-2">
              <Search className="h-4 w-4" /> Lookup
            </Button>
          </div>

          {foundUser ? (
            <div className="rounded-xl border bg-background p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                    {foundUser.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{foundUser.name}</p>
                    <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{foundUser.phone || "—"}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {new Date(foundUser.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge className="capitalize">{foundUser.role.replace("_", " ")}</Badge>
                  {foundUser.verified && <Badge className="bg-emerald-100 text-emerald-700 border-0">Verified</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => loadUserTickets(foundUser)}>
                  <Ticket className="h-3.5 w-3.5" />
                  View Tickets
                </Button>
                {!isSuperAdminAccount(foundUser) && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200" onClick={() => setShowNotify(true)}>
                    <Send className="h-3.5 w-3.5" />
                    Send Notification
                  </Button>
                )}
              </div>
            </div>
          ) : notFound && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
              <XCircle className="h-4 w-4 text-red-400" />
              No user found for &quot;{userSearch}&quot;
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <HeadphonesIcon className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle className="text-base">Support Queue</CardTitle>
              {openCount > 0 && (
                <Badge className="bg-red-100 text-red-700 border-0">{openCount} open</Badge>
              )}
            </div>
            <div className="flex gap-1">
              {["all", "open", "in_progress", "resolved", "payment", "refund"].map(f => (
                <button key={f} onClick={() => setFilterType(f)}
                  className={`text-xs px-2.5 py-1 rounded-full capitalize transition-colors
                    ${filterType === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && filteredTickets.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
                <p className="font-medium">Queue clear</p>
                <p className="text-sm text-muted-foreground">No tickets in this category</p>
              </div>
            )}
            {!loading && filteredTickets.map(ticket => {
              const pCfg = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;
              const sCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
              return (
                <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium">{ticket.subject}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pCfg.color}`}>{pCfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.name}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{ticket.email}</span>
                      <span className="capitalize">{ticket.type}</span>
                      <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl">{ticket.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.color}`}>
                      <sCfg.icon className="h-3 w-3" /> {sCfg.label}
                    </span>
                    {ticket.status !== "resolved" && (
                      <Button size="sm" variant="outline" className="text-xs text-emerald-600 border-emerald-200"
                        onClick={() => handleStatusChange(ticket.id, "resolved")}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showTickets} onOpenChange={setShowTickets}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              {foundUser?.name}&apos;s Tickets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {userTickets.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No tickets found for this user</p>
            )}
            {userTickets.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div>
                  <p className="text-sm font-medium">{t.event_title}</p>
                  <p className="text-xs text-muted-foreground">{t.ticket_type_name} · {new Date(t.purchased_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold">${Number(t.total_paid).toFixed(2)}</p>
                  <Badge className={t.payment_status === "completed" ? "bg-emerald-100 text-emerald-700 border-0 text-xs" : "text-xs"}>
                    {t.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTickets(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNotify} onOpenChange={setShowNotify}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Send Notification
            </DialogTitle>
          </DialogHeader>
          {foundUser && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">To: {foundUser.name}</p>
                <p className="text-muted-foreground text-xs">{foundUser.email}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  value={notifyMsg}
                  onChange={e => setNotifyMsg(e.target.value)}
                  placeholder="Type your message to this user…"
                  rows={4}
                />
              </div>
              {notifyError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  {notifyError}
                </div>
              )}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Sends a real email via Resend. This action is logged.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotify(false)} disabled={notifySending}>Cancel</Button>
            <Button onClick={handleSendNotification} disabled={!notifyMsg.trim() || notifySending} className="bg-primary gap-2">
              <Send className="h-4 w-4" /> {notifySending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
