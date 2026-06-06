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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DollarSign, Search, RefreshCw, Download, RotateCcw, AlertTriangle,
  CheckCircle2, XCircle, Clock, CreditCard, TrendingUp,
} from "lucide-react";
import { mockTickets } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { logAuditAction } from "@/lib/audit-logger";

// Build transaction list from mock tickets
interface TxRecord {
  id: string;
  reference: string;
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  amount: number;
  currency: string;
  provider: string;
  status: "paid" | "pending" | "failed" | "refunded";
  createdAt: string;
}

function buildTransactions(): TxRecord[] {
  return mockTickets.map((t) => ({
    id: t.id,
    reference: t.id,
    buyerName: t.buyerName,
    buyerEmail: "",
    eventTitle: t.eventTitle,
    amount: t.totalPaid,
    currency: t.currency,
    provider: t.paymentMethod,
    status: t.paymentStatus === "completed" ? "paid" : t.paymentStatus as "paid" | "pending" | "failed" | "refunded",
    createdAt: t.purchasedAt,
  }));
}

const STATUS_CONFIG = {
  paid: { label: "Paid", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700" },
  failed: { label: "Failed", icon: XCircle, color: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", icon: RotateCcw, color: "bg-blue-100 text-blue-700" },
};

export default function TransactionsPage() {
  const { user: adminUser } = useAuth();
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [confirmRefund, setConfirmRefund] = useState<TxRecord | null>(null);
  const [refundedIds, setRefundedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTxs(buildTransactions());
    const stored = localStorage.getItem("eticket_refunded_txs");
    setRefundedIds(new Set(stored ? JSON.parse(stored) : []));
  }, []);

  const filtered = txs.filter(t => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      t.buyerName.toLowerCase().includes(s) ||
      t.reference.toLowerCase().includes(s) ||
      t.eventTitle.toLowerCase().includes(s);
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchProvider = filterProvider === "all" || t.provider === filterProvider;
    return matchSearch && matchStatus && matchProvider;
  });

  const handleRefund = (tx: TxRecord) => {
    if (!adminUser) return;
    const ids = new Set(refundedIds);
    ids.add(tx.id);
    setRefundedIds(ids);
    localStorage.setItem("eticket_refunded_txs", JSON.stringify([...ids]));
    logAuditAction(adminUser, "ticket.refund",
      `Manual refund processed for ${tx.reference} ($${tx.amount})`, tx.id);
    setConfirmRefund(null);
  };

  const exportCSV = () => {
    const rows = [
      ["Reference", "Buyer", "Event", "Amount", "Currency", "Provider", "Status", "Date"],
      ...filtered.map(t => [t.reference, t.buyerName, t.eventTitle, t.amount, t.currency, t.provider, t.status, t.createdAt]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click();
    URL.revokeObjectURL(url);
    if (adminUser) logAuditAction(adminUser, "ticket.refund", "Exported transactions CSV");
  };

  const totalRevenue = txs.filter(t => t.status === "paid" && !refundedIds.has(t.id))
    .reduce((s, t) => s + t.amount, 0);
  const totalRefunded = txs.filter(t => refundedIds.has(t.id))
    .reduce((s, t) => s + t.amount, 0);
  const platformFees = totalRevenue * 0.1;
  const pendingAmt = txs.filter(t => t.status === "pending").reduce((s, t) => s + t.amount, 0);

  const providers = [...new Set(txs.map(t => t.provider))];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">Full payment ledger with manual refund controls.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Net Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Platform Fees (10%)", value: `$${platformFees.toFixed(2)}`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Refunded", value: `$${totalRefunded.toFixed(2)}`, icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Pending", value: `$${pendingAmt.toFixed(2)}`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(k => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg}`}>
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search reference, buyer, event…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProvider} onValueChange={setFilterProvider}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Provider" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => setTxs(buildTransactions())} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest">Reference</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest">Buyer</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest hidden md:table-cell">Event</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest hidden sm:table-cell">Provider</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest hidden lg:table-cell">Date</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No transactions found</td></tr>
                )}
                {filtered.map(tx => {
                  const isRefunded = refundedIds.has(tx.id);
                  const effectiveStatus = isRefunded ? "refunded" : tx.status;
                  const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{tx.reference.slice(0, 12)}…</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-sm">{tx.buyerName}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <p className="text-sm truncate max-w-[180px]">{tx.eventTitle}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-sm">${tx.amount.toFixed(2)}</td>
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
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!isRefunded && tx.status === "paid" && (
                          <Button size="sm" variant="outline" className="text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => setConfirmRefund(tx)}>
                            <RotateCcw className="h-3 w-3" /> Refund
                          </Button>
                        )}
                        {isRefunded && <span className="text-xs text-muted-foreground">Refunded</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Refund */}
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
              <p className="text-sm"><span className="text-muted-foreground">Amount:</span> <strong className="text-orange-600">${confirmRefund.amount.toFixed(2)}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Provider:</span> {confirmRefund.provider}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRefund(null)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => confirmRefund && handleRefund(confirmRefund)}>
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
