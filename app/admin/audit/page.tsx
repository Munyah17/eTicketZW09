"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Search, Download, RefreshCw,
  User, DollarSign, Settings2, Ticket, Users, HeadphonesIcon, Image as ImageIcon,
} from "lucide-react";
import { ACTION_LABELS, getAuditCategory, AuditAction } from "@/lib/audit-logger";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  User: { color: "bg-blue-100 text-blue-700", icon: User },
  Staff: { color: "bg-indigo-100 text-indigo-700", icon: Shield },
  Event: { color: "bg-violet-100 text-violet-700", icon: Ticket },
  Financial: { color: "bg-emerald-100 text-emerald-700", icon: DollarSign },
  Platform: { color: "bg-orange-100 text-orange-700", icon: Settings2 },
  Organizer: { color: "bg-purple-100 text-purple-700", icon: Users },
  Ticket: { color: "bg-cyan-100 text-cyan-700", icon: Ticket },
  Banner: { color: "bg-pink-100 text-pink-700", icon: ImageIcon },
  Support: { color: "bg-teal-100 text-teal-700", icon: HeadphonesIcon },
  Auth: { color: "bg-gray-100 text-gray-700", icon: Shield },
  Other: { color: "bg-gray-100 text-gray-700", icon: Shield },
};

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
  const [log, setLog] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit");
      const json = await res.json();
      setLog(json.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = log.filter(e => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      e.actor_name.toLowerCase().includes(s) ||
      JSON.stringify(e.details ?? {}).toLowerCase().includes(s) ||
      e.action.toLowerCase().includes(s);
    const cat = getAuditCategory(e.action);
    const matchCat = filterCat === "all" || cat === filterCat;
    return matchSearch && matchCat;
  });

  const exportCSV = () => {
    const rows = [
      ["Timestamp", "Actor", "Email", "Action", "Details", "Resource"],
      ...filtered.map(e => [e.created_at, e.actor_name, e.actor_email ?? "", e.action, JSON.stringify(e.details ?? {}), e.resource_id ?? ""]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const categories = ["all", ...Object.keys(CATEGORY_CONFIG).filter((c) => c !== "Other")];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Complete, tamper-evident record of every admin action on the platform. {log.length} entries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        {Object.entries(CATEGORY_CONFIG).filter(([cat]) => cat !== "Other").map(([cat, cfg]) => {
          const count = log.filter(e => getAuditCategory(e.action) === cat).length;
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search actions, actors, details…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c === "all" ? "All Categories" : c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : log.length === 0 ? (
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
                const cat = getAuditCategory(entry.action);
                const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other;
                return (
                  <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${cfg.color}`}>
                      <cfg.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{ACTION_LABELS[entry.action as AuditAction] || entry.action}</p>
                        <Badge className={`text-[10px] px-1.5 border-0 ${cfg.color}`}>{cat}</Badge>
                      </div>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{JSON.stringify(entry.details)}</p>
                      )}
                      {entry.resource_id && (
                        <p className="text-xs text-muted-foreground font-mono">target: {entry.resource_id.slice(0, 20)}…</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">{entry.actor_name}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
