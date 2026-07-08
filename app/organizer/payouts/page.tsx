"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ExportMenu } from "@/components/ui/export-menu";
import type { ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  Plus,
  Edit2,
  Trash2,
  Star,
} from "lucide-react";
import { PayoutRequest, MINIMUM_PAYOUT, PAYOUT_TRANSACTION_COST_PERCENTAGE, PAYOUT_METHODS } from "@/lib/types";

interface SavedPayoutMethod {
  id: string;
  label: string;
  paymentMethod: string;
  paymentDetails: string;
  isDefault: boolean;
}

function mapPayout(r: Record<string, unknown>): PayoutRequest {
  return {
    id: r.id as string,
    organizerId: r.organizer_id as string,
    organizerName: r.organizer_name as string,
    amount: Number(r.amount),
    currency: "USD",
    status: r.status as PayoutRequest["status"],
    requestedAt: r.requested_at as string,
    processedAt: r.processed_at as string | undefined,
    processedBy: r.processed_by as string | undefined,
    declineReason: r.decline_reason as string | undefined,
    paymentMethod: r.payment_method as string,
    paymentDetails: r.payment_details as string,
    transactionCost: Number(r.transaction_cost),
  };
}

export default function OrganizerPayoutsPage() {
  const [organizerPayouts, setOrganizerPayouts] = useState<PayoutRequest[]>([]);
  const [savedMethods, setSavedMethods] = useState<SavedPayoutMethod[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [minPayout, setMinPayout] = useState(MINIMUM_PAYOUT);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [methodsDialogOpen, setMethodsDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<SavedPayoutMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [methodError, setMethodError] = useState("");
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethodId: "",
    paymentMethod: "ecocash",
    fieldValues: {} as Record<string, string>,
  });
  const [methodFormData, setMethodFormData] = useState({
    label: "",
    paymentMethod: "ecocash",
    fieldValues: {} as Record<string, string>,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [payoutsRes, methodsRes] = await Promise.all([
        fetch("/api/organizer/payouts"),
        fetch("/api/organizer/payouts/methods"),
      ]);
      const payoutsJson = await payoutsRes.json();
      const methodsJson = await methodsRes.json();
      if (payoutsRes.ok) {
        setOrganizerPayouts(((payoutsJson.payouts ?? []) as Record<string, unknown>[]).map(mapPayout));
        setAvailableBalance(payoutsJson.availableBalance ?? 0);
        if (typeof payoutsJson.minPayout === "number") setMinPayout(payoutsJson.minPayout);
      }
      if (methodsRes.ok) {
        setSavedMethods(((methodsJson.methods ?? []) as Record<string, unknown>[]).map((m) => ({
          id: m.id as string,
          label: m.label as string,
          paymentMethod: m.payment_method as string,
          paymentDetails: m.payment_details as string,
          isDefault: (m.is_default as boolean) || false,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const pendingPayouts = organizerPayouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);

  const exportColumns: ExportColumn<PayoutRequest>[] = [
    { header: "Amount", accessor: (p) => p.amount },
    { header: "Currency", accessor: (p) => p.currency },
    { header: "Status", accessor: (p) => p.status },
    { header: "Method", accessor: (p) => p.paymentMethod },
    { header: "Requested", accessor: (p) => p.requestedAt },
    { header: "Processed", accessor: (p) => p.processedAt ?? "" },
  ];

  const handleSavePayoutMethod = async () => {
    setMethodError("");
    if (!methodFormData.label.trim()) {
      setMethodError("Method label is required");
      return;
    }

    const selectedMethod = PAYOUT_METHODS.find(m => m.value === methodFormData.paymentMethod);
    const paymentDetails = selectedMethod?.fields
      .map(f => `${f.label}: ${methodFormData.fieldValues[f.label] || ''}`)
      .join(' | ') || '';

    if (!paymentDetails) {
      setMethodError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const method = editingMethod ? "PUT" : "POST";
      const url = editingMethod ? `/api/organizer/payouts/methods/${editingMethod.id}` : "/api/organizer/payouts/methods";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: methodFormData.label,
          paymentMethod: selectedMethod?.label || methodFormData.paymentMethod,
          paymentDetails,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMethodError(json.error ?? "Failed to save method"); return; }
      setMethodsDialogOpen(false);
      setEditingMethod(null);
      setMethodFormData({ label: "", paymentMethod: "ecocash", fieldValues: {} });
      reload();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayoutMethod = async (methodId: string) => {
    if (!confirm("Are you sure you want to delete this payout method?")) return;
    try {
      const res = await fetch(`/api/organizer/payouts/methods/${methodId}`, { method: "DELETE" });
      if (!res.ok) return;
      reload();
    } catch (error) {
      console.error("Error deleting method:", error);
    }
  };

  const handleRequestPayout = async () => {
    setRequestError("");
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < minPayout) {
      setRequestError(`Minimum payout is $${minPayout}`);
      return;
    }

    let paymentDetails = "";
    let paymentMethodLabel = "";

    if (formData.paymentMethodId) {
      const method = savedMethods.find(m => m.id === formData.paymentMethodId);
      if (!method) {
        setRequestError("Selected payment method not found");
        return;
      }
      paymentDetails = method.paymentDetails;
      paymentMethodLabel = method.paymentMethod;
    } else {
      const selectedMethod = PAYOUT_METHODS.find(m => m.value === formData.paymentMethod);
      paymentDetails = selectedMethod?.fields
        .map(f => `${f.label}: ${formData.fieldValues[f.label] || ''}`)
        .join(' | ') || '';
      paymentMethodLabel = selectedMethod?.label || formData.paymentMethod;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/organizer/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethod: paymentMethodLabel,
          paymentDetails,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setRequestError(json.error ?? "Failed to request payout"); return; }
      setDialogOpen(false);
      setFormData({ amount: "", paymentMethodId: "", paymentMethod: "ecocash", fieldValues: {} });
      reload();
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "processing":
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-amber-100 text-amber-700",
      processing: "bg-blue-100 text-blue-700",
      approved: "bg-green-100 text-green-700",
      declined: "bg-red-100 text-red-700",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payouts</h1>
          <p className="text-muted-foreground mt-1">
            Request withdrawals from your earnings
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Request Payout
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Available Balance" value={`$${availableBalance.toLocaleString()}`} icon={Wallet} iconClassName="bg-green-100 text-green-700" />
        <StatCard label="Pending Payouts" value={`$${pendingPayouts.toLocaleString()}`} icon={Clock} iconClassName="bg-amber-100 text-amber-700" />
        <StatCard
          label="Total Withdrawn"
          value={`$${organizerPayouts.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0).toLocaleString()}`}
          icon={DollarSign}
          iconClassName="bg-primary/10 text-primary"
        />
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Payout Information</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>Minimum withdrawal amount: ${minPayout}</li>
                <li>Transaction cost: {PAYOUT_TRANSACTION_COST_PERCENTAGE}% per withdrawal</li>
                <li>Processing time: 1-3 business days</li>
                <li>All payouts are manually reviewed for security</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saved Payout Methods */}
      {savedMethods.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Saved Payout Methods</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingMethod(null);
                setMethodFormData({ label: "", paymentMethod: "ecocash", fieldValues: {} });
                setMethodsDialogOpen(true);
              }}
              disabled={savedMethods.length >= 5}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Method
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{method.label}</p>
                      {method.isDefault && (
                        <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{method.paymentMethod}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingMethod(method);
                        setMethodFormData({
                          label: method.label,
                          paymentMethod: PAYOUT_METHODS.find(m => m.label === method.paymentMethod)?.value || "ecocash",
                          fieldValues: {},
                        });
                        setMethodsDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePayoutMethod(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payout History</CardTitle>
          <ExportMenu rows={organizerPayouts} columns={exportColumns} filename="my-payouts" title="Payout History" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && organizerPayouts.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No payout requests yet</TableCell></TableRow>
              )}
              {!loading && organizerPayouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    {new Date(payout.requestedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    ${payout.amount} {payout.currency}
                    <span className="text-xs text-muted-foreground block">
                      Fee: ${payout.transactionCost}
                    </span>
                  </TableCell>
                  <TableCell>{payout.paymentMethod}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {payout.paymentDetails}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(payout.status)}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(
                          payout.status
                        )}`}
                      >
                        {payout.status}
                      </span>
                    </div>
                    {payout.declineReason && (
                      <p className="text-xs text-red-600 mt-1">
                        {payout.declineReason}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Request Payout Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Request a withdrawal from your available balance. Minimum amount is $
              {minPayout}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-mono font-bold">${availableBalance.toLocaleString()}</p>
            </div>

            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                min={minPayout}
                max={availableBalance}
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder={`Min $${minPayout}`}
              />
            </div>

            {savedMethods.length > 0 && (
              <div>
                <Label>Use Saved Method</Label>
                <Select
                  value={formData.paymentMethodId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, paymentMethodId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a saved method or enter new details below" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.label} - {method.paymentMethod}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!formData.paymentMethodId && (
              <>
                <div>
                  <Label>Payment Method</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: value, fieldValues: {} }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {PAYOUT_METHODS.find(m => m.value === formData.paymentMethod)?.fields.map((field, index) => (
                  <div key={index}>
                    <Label htmlFor={`field-${index}`}>{field.label}</Label>
                    <Input
                      id={`field-${index}`}
                      type={field.type || "text"}
                      value={formData.fieldValues[field.label] || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          fieldValues: { ...prev.fieldValues, [field.label]: e.target.value }
                        }))
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  </div>
                ))}
              </>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm">
                <strong>Transaction fee:</strong> {PAYOUT_TRANSACTION_COST_PERCENTAGE}% will be deducted from your payout amount.
                You will receive <strong className="font-mono">${formData.amount ? Math.max(0, parseFloat(formData.amount || "0") * (1 - PAYOUT_TRANSACTION_COST_PERCENTAGE / 100)).toFixed(2) : "0.00"}</strong>.
              </p>
            </div>
            {formData.paymentMethod === "cash_pickup" && (
              <p className="text-xs text-amber-600">
                Cash Pick-Up requires manual approval. Processing may take 3-5 business days.
              </p>
            )}
            {requestError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{requestError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleRequestPayout} disabled={submitting}>
              {submitting ? "Requesting…" : "Request Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Payout Method Dialog */}
      <Dialog open={methodsDialogOpen} onOpenChange={setMethodsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMethod ? "Edit Payout Method" : "Add Payout Method"}</DialogTitle>
            <DialogDescription>
              Save this payout method for quick use in future payouts. You can save up to 5 methods.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="methodLabel">Method Label</Label>
              <Input
                id="methodLabel"
                placeholder="e.g., My EcoCash, Work Account"
                value={methodFormData.label}
                onChange={(e) =>
                  setMethodFormData((prev) => ({ ...prev, label: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select
                value={methodFormData.paymentMethod}
                onValueChange={(value) =>
                  setMethodFormData((prev) => ({ ...prev, paymentMethod: value, fieldValues: {} }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {PAYOUT_METHODS.find(m => m.value === methodFormData.paymentMethod)?.fields.map((field, index) => (
              <div key={index}>
                <Label htmlFor={`method-field-${index}`}>{field.label}</Label>
                <Input
                  id={`method-field-${index}`}
                  type={field.type || "text"}
                  value={methodFormData.fieldValues[field.label] || ""}
                  onChange={(e) =>
                    setMethodFormData((prev) => ({
                      ...prev,
                      fieldValues: { ...prev.fieldValues, [field.label]: e.target.value }
                    }))
                  }
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </div>
            ))}

            {methodError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{methodError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodsDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSavePayoutMethod} disabled={submitting}>
              {submitting ? "Saving…" : "Save Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
