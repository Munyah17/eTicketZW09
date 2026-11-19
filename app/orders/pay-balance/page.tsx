"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ONLINE_PAYMENT_PROVIDERS } from "@/lib/types";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface OrderStatus {
  reference: string;
  status: string;
  total: number;
  amountPaid: number;
  balance: number;
  quantity: number;
}

const ACTIVE_PROVIDERS = ONLINE_PAYMENT_PROVIDERS.filter((p) => p.active);

export default function PayBalancePage() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState<string>(ACTIVE_PROVIDERS[0]?.id || "paynow");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Arriving from the payment-confirmation "Pay Balance" link carries the
  // order reference in ?ref= — pre-fill it so the buyer only enters their email.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReference(ref.toUpperCase());
  }, []);

  const lookup = async () => {
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const res = await fetch(`/api/orders/pay-balance?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Order not found");
        return;
      }
      setOrder(data);
      setAmount(data.balance.toFixed(2));
    } catch {
      setError("Could not look up order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/orders/pay-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderReference: reference,
          buyerEmail: email,
          provider,
          amount: Number(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not start payment");
        return;
      }
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      // Bank transfer / poll-based providers return no redirect — show success.
      setDone(true);
      setOrder((o) => (o ? { ...o, balance: data.balanceAfter } : o));
    } catch {
      setError("Payment failed to start. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const settled = order?.status === "paid";
  const hasBalance = order ? order.balance > 0.004 : false;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-10">
        <div className="mx-auto max-w-lg px-4">
          <Card>
            <CardHeader>
              <CardTitle>Pay your balance</CardTitle>
              <CardDescription>
                Enter your order reference and the email used at checkout to see what&apos;s left and pay it off.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ref">Order reference</Label>
                  <Input id="ref" placeholder="ORD-XXXXXXXX" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Buyer email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <Button onClick={lookup} disabled={loading || !reference || !email} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Look up order
              </Button>

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              {order && (
                <div className="space-y-4 rounded-lg border p-4">
                  {settled ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> This order is fully paid — your tickets have been issued.
                    </div>
                  ) : !hasBalance ? (
                    <div className="text-sm text-muted-foreground">No outstanding balance on this order.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-md bg-muted p-2">
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="font-semibold">${order.total.toFixed(2)}</div>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <div className="text-xs text-muted-foreground">Paid</div>
                          <div className="font-semibold">${order.amountPaid.toFixed(2)}</div>
                        </div>
                        <div className="rounded-md bg-primary/10 p-2">
                          <div className="text-xs text-muted-foreground">Balance</div>
                          <div className="font-semibold text-primary">${order.balance.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="amt">Amount to pay (up to ${order.balance.toFixed(2)})</Label>
                        <Input id="amt" type="number" min="1" max={order.balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        <p className="text-xs text-muted-foreground">Pay the full balance or part of it — you can pay the rest later.</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Payment method</Label>
                        <div className="grid gap-2">
                          {ACTIVE_PROVIDERS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setProvider(p.id)}
                              className={`rounded-md border p-3 text-left text-sm transition-colors ${provider === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="block text-xs text-muted-foreground">{p.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {done ? (
                        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
                          <CheckCircle2 className="h-4 w-4" /> Payment submitted. Your tickets will be issued once the balance is fully settled.
                        </div>
                      ) : (
                        <Button onClick={pay} disabled={paying || !amount || Number(amount) <= 0} className="w-full">
                          {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Pay ${Number(amount || 0).toFixed(2)}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
