"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Clock, CreditCard, RefreshCw, ShieldAlert, Ticket,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/export-menu";
import type { ExportColumn } from "@/lib/export-utils";

// Grace period before we offer a manual override — gives a real webhook
// (or the customer's own confirmation-page visit, which re-checks Stripe
// directly) a chance to resolve the payment first.
const VERIFY_GRACE_MS = 40_000;

interface AdminPayment {
  id: string;
  reference: string;
  provider: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "paid_refund_required";
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  hasTicket: boolean;
}

const STATUS_CONFIG = {
  paid: { label: "Paid", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Pending", icon: Clock, color: "bg-amber-100 text-amber-700" },
  failed: { label: "Failed", icon: XCircle, color: "bg-red-100 text-red-700" },
  // Money was captured but the ticket type sold out before fulfillment could
  // issue a ticket (two buyers racing for the last spot) — needs a human to
  // refund the buyer or raise capacity and re-trigger. Never automatic.
  paid_refund_required: { label: "Refund Required", icon: ShieldAlert, color: "bg-red-100 text-red-700" },
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [confirmAction, setConfirmAction] = useState<{ payment: AdminPayment; status: "paid" | "failed" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payments");
      const data = await res.json();
      if (res.ok) setPayments(data.payments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refreshTimer = setInterval(load, 15_000);
    const clockTimer = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
    };
  }, [load]);

  const runAction = async () => {
    if (!confirmAction) return;
    setSubmitting(true);
    try {
      await fetch(`/api/admin/payments/${confirmAction.payment.reference}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmAction.status }),
      });
      await load();
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
  };

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  const exportColumns: ExportColumn<AdminPayment>[] = [
    { header: "Reference", accessor: (p) => p.reference },
    { header: "Provider", accessor: (p) => p.provider },
    { header: "Amount", accessor: (p) => p.amount },
    { header: "Currency", accessor: (p) => p.currency },
    { header: "Status", accessor: (p) => p.status },
    { header: "Error", accessor: (p) => p.error_message ?? "" },
    { header: "Created", accessor: (p) => p.created_at },
    { header: "Updated", accessor: (p) => p.updated_at },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Verification</h1>
          <p className="text-muted-foreground mt-1">
            Live payment ledger. Stripe and Paynow webhooks are configured and verified — most payments
            confirm automatically. Manual verification is a fallback for a payment stuck pending; check the
            provider dashboard for the real outcome before approving.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu rows={payments} columns={exportColumns} filename="payments" title="Payment Verification" />
          <Button variant="outline" className="gap-2" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {pendingCount} payment{pendingCount > 1 ? "s" : ""} awaiting confirmation.
        </div>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Reference</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Buyer / Event</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Provider</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs font-mono uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {!loading && payments.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No payments yet</td></tr>
                )}
                {payments.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const m = (p.metadata ?? {}) as Record<string, unknown>;
                  const ageMs = now - new Date(p.created_at).getTime();
                  const canVerifyManually = p.status === "pending" && ageMs >= VERIFY_GRACE_MS;
                  const secondsLeft = Math.max(0, Math.ceil((VERIFY_GRACE_MS - ageMs) / 1000));

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{p.reference.slice(0, 12)}…</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-sm">{(m.buyerName as string) || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">{(m.eventTitle as string) || "—"}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-sm">{p.currency} {Number(p.amount).toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-xs">
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <cfg.icon className="h-3 w-3" /> {cfg.label}
                        </span>
                        {p.status === "paid" && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Ticket className="h-3 w-3" /> {p.hasTicket ? "Issued" : "Issuing…"}
                          </span>
                        )}
                        {p.status === "paid_refund_required" && p.error_message && (
                          <p className="mt-1 max-w-xs text-xs text-red-700">{p.error_message}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {p.status === "pending" && !canVerifyManually && (
                          <span className="text-xs text-muted-foreground">Waiting on webhook ({secondsLeft}s)</span>
                        )}
                        {canVerifyManually && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => setConfirmAction({ payment: p, status: "paid" })}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setConfirmAction({ payment: p, status: "failed" })}
                            >
                              <XCircle className="h-3 w-3" /> Decline
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={confirmAction?.status === "paid" ? "text-emerald-600" : "text-red-600"}>
              {confirmAction?.status === "paid" ? "Confirm Payment Received?" : "Confirm Payment Failed?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.status === "paid"
                ? "Only approve if you've verified this exact amount was actually received in your Stripe or Paynow dashboard. This will immediately issue a ticket and email it to the buyer."
                : "This marks the payment as failed. The buyer will need to retry checkout."}
            </DialogDescription>
          </DialogHeader>
          {confirmAction && (
            <div className="py-2 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Reference:</span> <span className="font-mono text-xs">{confirmAction.payment.reference}</span></p>
              <p><span className="text-muted-foreground">Amount:</span> <strong className="font-mono">{confirmAction.payment.currency} {Number(confirmAction.payment.amount).toFixed(2)}</strong></p>
              <p><span className="text-muted-foreground">Provider:</span> {confirmAction.payment.provider}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={submitting}>Cancel</Button>
            <Button
              className={confirmAction?.status === "paid" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              onClick={runAction}
              disabled={submitting}
            >
              {submitting ? "Processing…" : confirmAction?.status === "paid" ? "Approve & Issue Ticket" : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
