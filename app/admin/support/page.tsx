"use client";

import { useState } from "react";
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
import { demoUsers, getRegisteredUsers, isSuperAdminAccount } from "@/lib/auth-context";
import { mockTickets, mockEvents } from "@/lib/mock-data";
import { User as UserType } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { logAuditAction } from "@/lib/audit-logger";

// Mock support tickets
const MOCK_SUPPORT = [
  { id: "sup-001", type: "payment", priority: "high", user: "Tatenda Moyo", email: "user@example.com", subject: "Payment deducted but no ticket received", status: "open", created: "2024-11-28T10:00:00Z" },
  { id: "sup-002", type: "refund", priority: "medium", user: "John Doe", email: "john@example.com", subject: "Request refund for cancelled event", status: "open", created: "2024-11-27T14:30:00Z" },
  { id: "sup-003", type: "account", priority: "low", user: "Mary Nyamande", email: "mary@example.com", subject: "Cannot login to account", status: "resolved", created: "2024-11-26T09:15:00Z" },
  { id: "sup-004", type: "organizer", priority: "high", user: "Ghettocracy Entertainment", email: "info@ghettocracy.co.zw", subject: "Payout delayed for 7 days", status: "open", created: "2024-11-25T11:00:00Z" },
  { id: "sup-005", type: "ticket", priority: "medium", user: "Peter Moyo", email: "peter@example.com", subject: "QR code not scanning at gate", status: "in_progress", created: "2024-11-24T16:45:00Z" },
  { id: "sup-006", type: "payment", priority: "high", user: "Susan Chikwanda", email: "susan@example.com", subject: "Double charged for one ticket", status: "open", created: "2024-11-23T08:20:00Z" },
];

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
  const { user: adminUser } = useAuth();
  const [userSearch, setUserSearch] = useState("");
  const [foundUser, setFoundUser] = useState<UserType | null>(null);
  const [showTickets, setShowTickets] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [tickets, setTickets] = useState(MOCK_SUPPORT);
  const [filterType, setFilterType] = useState("all");

  const allUsers = [
    ...Object.values(demoUsers),
    ...getRegisteredUsers().filter(r => !Object.values(demoUsers).find(d => d.email === r.email)),
  ];

  const handleUserLookup = () => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return;
    const found = allUsers.find(u =>
      u.email.toLowerCase() === q ||
      u.name.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
    setFoundUser(found || null);
  };

  const getUserTickets = (user: UserType) =>
    mockTickets.filter(t => t.buyerName === user.name);

  const handleSendNotification = () => {
    if (!adminUser || !foundUser || !notifyMsg.trim()) return;
    logAuditAction(adminUser, "platform.announcement",
      `Notification sent to ${foundUser.email}: "${notifyMsg.slice(0, 50)}"`, foundUser.id);
    alert(`Notification queued for ${foundUser.email}`);
    setShowNotify(false);
    setNotifyMsg("");
  };

  const handleResolve = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: "resolved" } : t));
    if (adminUser) logAuditAction(adminUser, "platform.feature_toggle", `Resolved support ticket ${id}`);
  };

  const filteredTickets = filterType === "all"
    ? tickets
    : tickets.filter(t => t.status === filterType || t.type === filterType);

  const openCount = tickets.filter(t => t.status === "open").length;
  const highCount = tickets.filter(t => t.priority === "high" && t.status !== "resolved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support & Operations</h1>
        <p className="text-muted-foreground mt-1">User lookup, manual overrides, and support ticket management.</p>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Open Tickets", value: openCount, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "High Priority", value: highCount, color: "text-red-600", bg: "bg-red-50" },
          { label: "Resolved Today", value: tickets.filter(t => t.status === "resolved").length, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                <HeadphonesIcon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User Lookup */}
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
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowTickets(true)}>
                  <Ticket className="h-3.5 w-3.5" />
                  View Tickets ({getUserTickets(foundUser).length})
                </Button>
                {!isSuperAdminAccount(foundUser) && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200" onClick={() => setShowNotify(true)}>
                    <Send className="h-3.5 w-3.5" />
                    Send Notification
                  </Button>
                )}
              </div>
            </div>
          ) : userSearch && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
              <XCircle className="h-4 w-4 text-red-400" />
              No user found for "{userSearch}"
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support Queue */}
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
            {filteredTickets.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
                <p className="font-medium">Queue clear</p>
                <p className="text-sm text-muted-foreground">No tickets in this category</p>
              </div>
            )}
            {filteredTickets.map(ticket => {
              const pCfg = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG];
              const sCfg = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
              return (
                <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium">{ticket.subject}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${pCfg.color}`}>{pCfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{ticket.user}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{ticket.email}</span>
                      <span className="capitalize">{ticket.type}</span>
                      <span>{new Date(ticket.created).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.color}`}>
                      <sCfg.icon className="h-3 w-3" /> {sCfg.label}
                    </span>
                    {ticket.status !== "resolved" && (
                      <Button size="sm" variant="outline" className="text-xs text-emerald-600 border-emerald-200"
                        onClick={() => handleResolve(ticket.id)}>
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

      {/* User Tickets Dialog */}
      <Dialog open={showTickets} onOpenChange={setShowTickets}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              {foundUser?.name}&apos;s Tickets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {foundUser && getUserTickets(foundUser).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No tickets found for this user</p>
            )}
            {foundUser && getUserTickets(foundUser).map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div>
                  <p className="text-sm font-medium">{t.eventTitle}</p>
                  <p className="text-xs text-muted-foreground">{t.ticketTypeName} · {new Date(t.purchasedAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${t.totalPaid.toFixed(2)}</p>
                  <Badge className={t.paymentStatus === "completed" ? "bg-emerald-100 text-emerald-700 border-0 text-xs" : "text-xs"}>
                    {t.paymentStatus}
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

      {/* Send Notification Dialog */}
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
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Requires an email/SMS provider to be configured. This action is logged.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotify(false)}>Cancel</Button>
            <Button onClick={handleSendNotification} disabled={!notifyMsg.trim()} className="bg-primary gap-2">
              <Send className="h-4 w-4" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
