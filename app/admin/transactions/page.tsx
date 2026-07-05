"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DollarSign, Search, RefreshCw, RotateCcw, AlertTriangle,
  CheckCircle2, XCircle, Clock, CreditCard, TrendingUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, inDateRange } from "@/components/ui/date-range-filter";
import type { ExportColumn } from "@/lib/export-utils";

interface TxRecord {
  id: string;
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  amount: number;
  currency: string;
  provider: string;
  status: "completed" | "pending" | "failed" | "refunded";
  createdAt: string;
}

function mapTx(r: Record<string, unknown>): TxRecord {
  return {
    id: r.id as string,
    buyerName: (r.buyer_display_name as string) || (r.buyer_name as string),
    buyerEmail: (r.buyer_email as string) ?? "",
    eventTitle: r.event_title as string,
    amount: Number(r.total_paid),
    currency: r.currency as string,
    provider: (r.payment_method as string) ?? "—",
    status: r.payment_status as TxRecord["status"],
    createdAt: r.purchased_at as string,
  };
}

const STATUS_CONFIG = {
  completed: { label: "Paid", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700" },
  failed: { label: "Failed", icon: XCircle, color: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", icon: RotateCcw, color: "bg-blue-100 text-blue-700" },
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, used: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [confirmRefund, setConfirmRefund] = useState<TxRecord | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets?search=${encodeURIComponent(search)}&page=${page}`);
      const json = await res.json();
      setTxs(((json.tickets ?? []) as Record<string, unknown>[]).map(mapTx));
      setStats(json.stats ?? { total: 0, valid: 0, used: 0, revenue: 0 });
      setPages(json.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { reload(); }, [reload]);

  const handleRefund = async (tx: TxRecord) => {
    setRefunding(true);
    try {
      await fetch("/api/admin/transactions/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: tx.id }),
      });
      setConfirmRefund(null);
      reload();
    } finally {
      setRefunding(false);
    }
  };

  const exportableTxs = txs.filter(t => inDateRange(t.createdAt, dateFrom, dateTo));
  const exportColumns: ExportColumn<TxRecord>[] = [
    { header: "Reference", accessor: (t) => t.id },
    { header: "Buyer", accessor: (t) => t.buyerName },
    { header: "Event", accessor: (t) => t.eventTitle },
    { header: "Amount", accessor: (t) => t.amount },
    { header: "Currency", accessor: (t) => t.currency },
    { header: "Provider", accessor: (t) => t.provider },
    { header: "Status", accessor: (t) => t.status },
    { header: "Date", accessor: (t) => t.createdAt },
  ];

  const platformFees = stats.revenue * 0.1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">Full payment ledger with manual refund controls.</p>
        </div>
        <ExportMenu rows={exportableTxs} columns={exportColumns} filename="transactions" title="Transactions (current page)" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net Revenue" value={`$${stats.revenue.toFixed(2)}`} icon={DollarSign} iconClassName="bg-emerald-50 text-emerald-600" valueClassName="text-emerald-600" />
        <StatCard label="Platform Fees (10%)" value={`$${platformFees.toFixed(2)}`} icon={TrendingUp} iconClassName="bg-blue-50 text-blue-600" valueClassName="text-blue-600" />
        <StatCard label="Total Tickets" value={stats.total} icon={RotateCcw} iconClassName="bg-orange-50 text-orange-600" valueClassName="text-orange-600" />
        <StatCard label="Awaiting Gate Entry" value={stats.valid} icon={Clock} iconClassName="bg-amber-50 text-amber-600" valueClassName="text-amber-600" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search reference, buyer, email, event…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <Button variant="ghost" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Reference</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Buyer</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest hidden md:table-cell">Event</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest hidden sm:table-cell">Provider</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest hidden lg:table-cell">Date</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && (
                  <tr><td colSpan={8} className="text-center py-12"><RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                )}
                {!loading && txs.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No transactions found</td></tr>
                )}
                {!loading && txs.map(tx => {
                  const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{tx.id.slice(0, 12)}…</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-sm">{tx.buyerName}</p>
                        <p className="text-xs text-muted-foreground">{tx.buyerEmail}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <p className="text-sm truncate max-w-[180px]">{tx.eventTitle}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-sm">${tx.amount.toFixed(2)}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="flex items-center gap-1.5 text-xs">
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                          {tx.provider}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <cfg.icon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {tx.status === "completed" && (
                          <Button size="sm" variant="outline" className="text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => setConfirmRefund(tx)}>
                            <RotateCcw className="h-3 w-3" /> Refund
                          </Button>
                        )}
                        {tx.status === "refunded" && <span className="text-xs text-muted-foreground">Refunded</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && txs.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {page} of {pages} · {stats.total} total tickets</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmRefund} onOpenChange={() => setConfirmRefund(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" /> Confirm Refund
            </DialogTitle>
            <DialogDescription>
              This will mark the transaction as refunded. Actual funds reversal must be processed via your Stripe or Paynow dashboard.
            </DialogDescription>
          </DialogHeader>
          {confirmRefund && (
            <div className="py-2 space-y-1">
              <p className="text-sm"><span className="text-muted-foreground">Buyer:</span> <strong>{confirmRefund.buyerName}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Event:</span> {confirmRefund.eventTitle}</p>
              <p className="text-sm"><span className="text-muted-foreground">Amount:</span> <strong className="font-mono text-orange-600">${confirmRefund.amount.toFixed(2)}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Provider:</span> {confirmRefund.provider}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRefund(null)} disabled={refunding}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => confirmRefund && handleRefund(confirmRefund)} disabled={refunding}>
              {refunding ? "Processing…" : "Process Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
