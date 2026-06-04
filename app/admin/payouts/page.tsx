"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Clock, CheckCircle2, XCircle, AlertCircle, Banknote, Filter } from "lucide-react";
import { mockPayoutRequests } from "@/lib/mock-data";
import { PayoutRequest } from "@/lib/types";

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>(mockPayoutRequests);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<"approve" | "decline" | "process">("approve");
  const [declineReason, setDeclineReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredPayouts = payouts.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  const handleAction = () => {
    if (!selectedPayout) return;

    setPayouts((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPayout.id) return p;

        if (action === "approve") {
          return {
            ...p,
            status: "approved" as const,
            processedAt: new Date().toISOString(),
            processedBy: "admin",
          };
        } else if (action === "decline") {
          return {
            ...p,
            status: "declined" as const,
            processedAt: new Date().toISOString(),
            processedBy: "admin",
            declineReason,
          };
        } else if (action === "process") {
          return {
            ...p,
            status: "processing" as const,
          };
        }
        return p;
      })
    );

    setDialogOpen(false);
    setSelectedPayout(null);
    setDeclineReason("");
  };

  const statusConfig = {
    pending:    { label: "Pending",    icon: Clock,        cls: "bg-amber-100 text-amber-700 border-amber-200" },
    processing: { label: "Processing", icon: AlertCircle,  cls: "bg-blue-100 text-blue-700 border-blue-200" },
    approved:   { label: "Approved",   icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    declined:   { label: "Declined",   icon: XCircle,      cls: "bg-red-100 text-red-700 border-red-200" },
  } as const;

  const pendingCount    = payouts.filter(p => p.status === "pending").length;
  const processingCount = payouts.filter(p => p.status === "processing").length;
  const approvedCount   = payouts.filter(p => p.status === "approved").length;
  const totalPending    = payouts.filter(p => p.status === "pending" || p.status === "processing").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payout Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review and process organizer payout requests manually
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="gap-1.5 bg-amber-100 text-amber-700 border-amber-200 px-3 py-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {pendingCount} awaiting action
          </Badge>
        )}
      </div>

      {/* Pipeline stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pending", count: pendingCount, icon: Clock, color: "amber", dot: pendingCount > 0 },
          { label: "Processing", count: processingCount, icon: AlertCircle, color: "blue", dot: false },
          { label: "Approved", count: approvedCount, icon: CheckCircle2, color: "emerald", dot: false },
          { label: "Awaiting ($)", count: `$${totalPending.toLocaleString()}`, icon: Banknote, color: "violet", dot: false },
        ].map(item => (
          <Card key={item.label} className="border-0 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full bg-${item.color}-500`} />
            <CardContent className="p-5 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-bold mt-1">{item.count}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${item.color}-50 text-${item.color}-600`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
              {item.dot && (
                <p className="text-xs text-amber-600 mt-2 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Needs action
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
              <DollarSign className="h-4 w-4 text-violet-600" />
            </div>
            <CardTitle className="text-base">All Payout Requests</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-6">Organizer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method & Details</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayouts.map((payout) => {
                const cfg = statusConfig[payout.status as keyof typeof statusConfig] ?? statusConfig.pending;
                const StatusIcon = cfg.icon;
                const isActionable = payout.status === "pending" || payout.status === "processing";
                return (
                  <TableRow key={payout.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {payout.organizerName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{payout.organizerName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{payout.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-sm">${payout.amount} <span className="text-muted-foreground font-normal">{payout.currency}</span></p>
                      <p className="text-xs text-muted-foreground">Fee: ${payout.transactionCost}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs mb-1">{payout.paymentMethod}</Badge>
                      <p className="text-xs text-muted-foreground truncate max-w-44">{payout.paymentDetails}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{new Date(payout.requestedAt).toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-medium ${cfg.cls}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                      {payout.declineReason && (
                        <p className="text-xs text-red-600 mt-1 max-w-40 truncate">{payout.declineReason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {isActionable ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {payout.status === "pending" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                              onClick={() => { setSelectedPayout(payout); setAction("process"); setDialogOpen(true); }}>
                              Mark Processing
                            </Button>
                          )}
                          <Button size="sm" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => { setSelectedPayout(payout); setAction("approve"); setDialogOpen(true); }}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs px-2"
                            onClick={() => { setSelectedPayout(payout); setAction("decline"); setDialogOpen(true); }}>
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <span className={`text-xs font-medium ${payout.status === "approved" ? "text-emerald-600" : "text-red-500"}`}>
                          {payout.status === "approved" ? "✓ Completed" : "✗ Declined"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={action === "decline" ? "text-destructive" : action === "approve" ? "text-emerald-600" : ""}>
              {action === "approve" ? "✓ Approve Payout" : action === "decline" ? "✗ Decline Payout" : "⟳ Mark as Processing"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve"
                ? "Confirm you have sent the payment to the organizer's account."
                : action === "decline"
                ? "Provide a reason. The organizer will be notified."
                : "Mark this payout as currently being processed."}
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/60 p-4 space-y-2.5 border">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {selectedPayout.organizerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedPayout.organizerName}</p>
                    <p className="text-xs text-muted-foreground">{selectedPayout.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-bold text-base">${selectedPayout.amount} {selectedPayout.currency}</p></div>
                  <div><p className="text-xs text-muted-foreground">Net (after fee)</p><p className="font-medium">${(selectedPayout.amount - selectedPayout.transactionCost).toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Method</p><p className="font-medium capitalize">{selectedPayout.paymentMethod}</p></div>
                  <div><p className="text-xs text-muted-foreground">Details</p><p className="font-medium text-xs truncate">{selectedPayout.paymentDetails}</p></div>
                </div>
              </div>

              {action === "decline" && (
                <div>
                  <Label htmlFor="reason">Reason for Decline <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="reason"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="e.g. Invalid account details, insufficient documentation..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={action === "decline" && !declineReason.trim()}
              className={action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              variant={action === "decline" ? "destructive" : "default"}
            >
              {action === "approve" ? "Confirm & Approve" : action === "decline" ? "Decline Payout" : "Mark Processing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
