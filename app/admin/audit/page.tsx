"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Search, Download, Trash2, RefreshCw, AlertTriangle,
  User, DollarSign, Settings2, Ticket, Users,
} from "lucide-react";
import { getAuditLog, clearAuditLog, AuditEntry, ACTION_LABELS } from "@/lib/audit-logger";
import { useAuth } from "@/lib/auth-context";
import { logAuditAction } from "@/lib/audit-logger";

const ACTION_CATEGORY: Record<string, string> = {
  "user.": "User",
  "event.": "Event",
  "payout.": "Financial",
  "platform.": "Platform",
  "organizer.": "Organizer",
  "ticket.": "Ticket",
  "admin.": "Auth",
};

const CATEGORY_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  User: { color: "bg-blue-100 text-blue-700", icon: User },
  Event: { color: "bg-violet-100 text-violet-700", icon: Ticket },
  Financial: { color: "bg-emerald-100 text-emerald-700", icon: DollarSign },
  Platform: { color: "bg-orange-100 text-orange-700", icon: Settings2 },
  Organizer: { color: "bg-purple-100 text-purple-700", icon: Users },
  Ticket: { color: "bg-cyan-100 text-cyan-700", icon: Ticket },
  Auth: { color: "bg-gray-100 text-gray-700", icon: Shield },
};

function getCategory(action: string): string {
  for (const prefix in ACTION_CATEGORY) {
    if (action.startsWith(prefix)) return ACTION_CATEGORY[prefix];
  }
  return "Other";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-ZW", { day: "numeric", month: "short" });
}

export default function AuditPage() {
  const { user: adminUser } = useAuth();
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const reload = () => setLog(getAuditLog());
  useEffect(() => { reload(); }, []);

  const filtered = log.filter(e => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      e.adminName.toLowerCase().includes(s) ||
      e.detail.toLowerCase().includes(s) ||
      e.action.toLowerCase().includes(s);
    const cat = getCategory(e.action);
    const matchCat = filterCat === "all" || cat === filterCat;
    return matchSearch && matchCat;
  });

  const exportCSV = () => {
    const rows = [
      ["Timestamp", "Admin", "Email", "Action", "Detail", "Target"],
      ...filtered.map(e => [e.timestamp, e.adminName, e.adminEmail, e.action, e.detail, e.target || ""]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (!confirm("Clear all audit logs? This cannot be undone.")) return;
    if (adminUser) logAuditAction(adminUser, "platform.feature_toggle", "Cleared audit log");
    clearAuditLog();
    reload();
  };

  const categories = ["all", ...Object.values(ACTION_CATEGORY).filter((v, i, a) => a.indexOf(v) === i)];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Complete record of all admin actions on the platform. {log.length} entries stored.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {log.length > 0 && (
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleClear} title="Clear log">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Category counts */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
          const count = log.filter(e => getCategory(e.action) === cat).length;
          return (
            <Card key={cat}
              className={`border-0 shadow-sm cursor-pointer transition-all ${filterCat === cat ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
            >
              <CardContent className="p-3 text-center">
                <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg mb-1 ${cfg.color}`}>
                  <cfg.icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs text-muted-foreground">{cat}</p>
                <p className="text-lg font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search actions, admins, details…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c === "all" ? "All Categories" : c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Log table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {log.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium">No audit entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Actions taken on this admin panel will appear here automatically.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-sm">No matching entries</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(entry => {
                const cat = getCategory(entry.action);
                const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Auth;
                return (
                  <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${cfg.color}`}>
                      <cfg.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{ACTION_LABELS[entry.action] || entry.action}</p>
                        <Badge className={`text-[10px] px-1.5 border-0 ${cfg.color}`}>{cat}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.detail}</p>
                      {entry.target && (
                        <p className="text-xs text-muted-foreground font-mono">target: {entry.target.slice(0, 20)}…</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">{entry.adminName}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {log.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Audit logs are stored in browser localStorage. For persistent compliance-grade logging, connect a database (Supabase recommended).
          </p>
        </div>
      )}
    </div>
  );
}
