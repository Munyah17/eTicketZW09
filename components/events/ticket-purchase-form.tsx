"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Minus, Plus, Lock, ArrowLeft } from "lucide-react";
import { Event, PaymentProvider, PLATFORM_FEE_PERCENTAGE } from "@/lib/types";
import { calculatePlatformFee, calculateTotalWithFee } from "@/lib/pricing";
import { PaymentProviders } from "@/components/payment/payment-providers";
import { useAuth } from "@/lib/auth-context";

interface TicketPurchaseFormProps {
  event: Event;
  selectedTicketTypeId: string | null;
  onTicketTypeChange: (id: string | null) => void;
}

export function TicketPurchaseForm({
  event,
  selectedTicketTypeId,
  onTicketTypeChange,
}: TicketPurchaseFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerContact, setBuyerContact] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [step, setStep] = useState<"details" | "provider" | "processing" | "redirect">("details");
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [feePercent, setFeePercent] = useState(PLATFORM_FEE_PERCENTAGE);
  const cardRef = useRef<HTMLDivElement>(null);

  // Each step ("details" -> "provider" -> "processing" -> "redirect") renders
  // very different content heights -- going from the tall provider list down
  // to the short "session ready" card left the page's old scroll position
  // sitting below the new, shorter content, which reads as "it jumped to the
  // bottom" (it didn't move; the page under it just got shorter). Pulling
  // the card into view on every step change keeps whatever's actionable
  // actually on screen regardless of how tall the previous step was.
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step]);

  useEffect(() => {
    fetch("/api/platform-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.config?.service_fee_percent !== undefined) {
          setFeePercent(Number(data.config.service_fee_percent));
        }
      })
      .catch(() => {});
  }, []);

  const selectedTicketType = event.ticketTypes.find((t) => t.id === selectedTicketTypeId);
  const available = selectedTicketType
    ? selectedTicketType.quantity - selectedTicketType.sold
    : 0;

  const basePrice = selectedTicketType ? selectedTicketType.price * quantity : 0;
  const platformFee = calculatePlatformFee(basePrice, feePercent);
  const totalPrice = calculateTotalWithFee(basePrice, feePercent);
  const showBaseUrlWarning = !process.env.NEXT_PUBLIC_BASE_URL;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= Math.min(available, 10)) {
      setQuantity(newQuantity);
    }
  };

  const handleDetailsSubmit = () => {
    if (!buyerName || !buyerContact || !buyerEmail) return;
    setStep("provider");
    setPaymentError(null);
  };

  const handleProviderSelect = (providerId: string) => {
    if (providerId === "epay") return;
    handlePaymentSubmit(providerId as PaymentProvider);
  };

  const handlePaymentSubmit = async (provider: PaymentProvider) => {
    if (!selectedTicketType) return;

    setSelectedProvider(provider);
    setStep("processing");
    setPaymentError(null);
    setRedirectUrl(null);

    try {
      const response = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: `${event.title} - ${selectedTicketType.name} x ${quantity}`,
          amount: totalPrice,
          currency: selectedTicketType.currency,
          provider,
          origin: window.location.origin,
          user_id: user?.id,
          metadata: {
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            eventTime: event.time,
            venue: event.venue,
            ticketTypeId: selectedTicketTypeId,
            ticketTypeName: selectedTicketType.name,
            quantity,
            buyerName,
            buyerEmail,
            buyerPhone: buyerContact,
            displayName: useAnonymous ? "Anonymous" : displayName || buyerName,
            idNumber,
            // Dollar amount actually charged as the buyer-side service fee —
            // captured now so the wallet ledger reflects what this specific
            // sale really charged, not whatever the fee % happens to be by
            // the time fulfillment runs.
            platformFeeAmount: platformFee,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setPaymentError(data.error || "Payment initiation failed. Please try again.");
        setStep("provider");
        return;
      }

      // EcoCash Instant has no hosted checkout page — the charge request
      // itself sends a USSD PIN prompt straight to the buyer's phone, so
      // there's nothing to redirect to. Go straight to the confirmation
      // page, which polls for the outcome.
      if (provider === "ecocash") {
        sessionStorage.setItem(
          "lastPurchaseAttempt",
          JSON.stringify({
            id: data.reference,
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            eventTime: event.time,
            venue: event.venue,
            ticketType: selectedTicketType.name,
            quantity,
            buyerName,
            buyerContact,
            displayName: useAnonymous ? "Anonymous" : displayName || buyerName,
            paymentMethod: provider,
            totalPaid: totalPrice,
            currency: selectedTicketType.currency,
            purchasedAt: new Date().toISOString(),
          })
        );
        router.push(`/tickets/confirmation?ref=${data.reference}`);
        return;
      }

      if (!data.redirect_url) {
        setPaymentError("No checkout URL returned from payment provider. Please try again.");
        setStep("provider");
        return;
      }

      // Save minimal order context so confirmation page can display it
      sessionStorage.setItem(
        "lastPurchaseAttempt",
        JSON.stringify({
          id: data.reference,
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
          venue: event.venue,
          ticketType: selectedTicketType.name,
          quantity,
          buyerName,
          buyerContact,
          displayName: useAnonymous ? "Anonymous" : displayName || buyerName,
          paymentMethod: provider,
          totalPaid: totalPrice,
          currency: selectedTicketType.currency,
          purchasedAt: new Date().toISOString(),
        })
      );

      // Session created — show the explicit "Open Checkout" button.
      // window.open must be called from a direct user click to avoid popup blockers.
      setRedirectUrl(data.redirect_url);
      setStep("redirect");
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Network error. Please try again."
      );
      setStep("provider");
    }
  };

  if (!selectedTicketType) {
    return (
      <Card ref={cardRef}>
        <CardHeader>
          <CardTitle className="text-lg">Select a Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please select a ticket type from the options above to continue with your purchase.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Spinner shown while the API call is in flight
  if (step === "processing") {
    return (
      <Card ref={cardRef}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Spinner className="h-12 w-12" />
          <p className="mt-4 font-semibold">Connecting to payment gateway…</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedProvider === "paynow"
              ? "Creating your Paynow checkout session…"
              : selectedProvider === "ecocash"
              ? "Sending a payment request to your EcoCash wallet…"
              : "Creating your Stripe checkout session…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Checkout session is ready — user clicks this button to open the provider's hosted page in a new tab.
  // window.open is called directly from a click handler so it is never blocked by popup blockers.
  if (step === "redirect" && redirectUrl) {
    const providerName = selectedProvider === "paynow" ? "Paynow" : "Stripe";
    return (
      <Card ref={cardRef}>
        <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="text-center">
            <p className="font-semibold text-lg">Your checkout session is ready</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click the button below to complete your payment securely on {providerName}.
            </p>
          </div>
          <Button
            className="w-full bg-primary hover:bg-primary/90 gap-2"
            size="lg"
            onClick={() => window.open(redirectUrl, "_blank")}
          >
            Checkout with {providerName}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You will be taken to {providerName}&apos;s secure payment page in a new tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={cardRef}>
      <CardHeader>
        <CardTitle className="text-lg">
          {step === "details" ? "Your Details" : "Select Payment Method"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── Step 1: Buyer details ── */}
        {step === "details" && (
          <>
            <div className="rounded-lg bg-secondary/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedTicketType.name}</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    ${selectedTicketType.price.toFixed(2)} each
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTicketTypeChange(null)}
                  className="text-xs"
                >
                  Change
                </Button>
              </div>
            </div>

            <div>
              <Label>Quantity</Label>
              <div className="mt-2 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= Math.min(available, 10)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  (Max: {Math.min(available, 10)})
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="buyerName">Full Name *</Label>
                <Input
                  id="buyerName"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="buyerEmail">Email Address *</Label>
                <Input
                  id="buyerEmail"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="buyerContact">Phone Number *</Label>
                <Input
                  id="buyerContact"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  placeholder="+263 7X XXX XXXX"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="displayName">Display Name on Ticket</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nickname or short name (optional)"
                  className="mt-1.5"
                  disabled={useAnonymous}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="anonymous"
                    checked={useAnonymous}
                    onCheckedChange={(checked) => setUseAnonymous(checked as boolean)}
                  />
                  <Label htmlFor="anonymous" className="text-sm font-normal cursor-pointer">
                    Show as &quot;Anonymous&quot; on ticket
                  </Label>
                </div>
              </div>
              <div>
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="National ID or passport number"
                  className="mt-1.5"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Optional, but recommended — if your ticket is lost, stolen, or forgotten, this lets us verify
                  and admit you at the gate using just your ID.
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">${basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Processing Fee
                </span>
                <span className="font-mono">${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="font-heading text-lg text-primary">${totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <Button
              className="w-full gap-2 bg-primary hover:bg-primary/90"
              size="lg"
              onClick={handleDetailsSubmit}
              disabled={!buyerName || !buyerContact || !buyerEmail}
            >
              Continue to Payment
            </Button>
          </>
        )}

        {/* ── Step 2: Gateway selection — clicking a card immediately initiates checkout ── */}
        {step === "provider" && (
          <>
            <div className="rounded-lg bg-secondary/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {selectedTicketType.name} x {quantity}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.title}</p>
                </div>
                <span className="font-heading font-bold text-primary">${totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {paymentError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {paymentError}
              </div>
            )}

            {showBaseUrlWarning && (
              <Alert variant="default">
                <div className="font-medium">Missing NEXT_PUBLIC_BASE_URL</div>
                <div className="text-muted-foreground text-sm">
                  Return URLs will use the browser origin as a fallback. Set NEXT_PUBLIC_BASE_URL
                  in .env.local for stable production redirects.
                </div>
              </Alert>
            )}

            <PaymentProviders
              amount={totalPrice}
              selectedProvider={selectedProvider}
              onSelect={handleProviderSelect}
            />

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { setStep("details"); setPaymentError(null); }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Details
            </Button>
          </>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Secure checkout powered by E-TicketsZW</span>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Ticket sales are covered by our{" "}
          <Link href="/refund-policy" className="underline underline-offset-2 hover:text-foreground">Refund Policy</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
