"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Minus, Plus, Lock, ArrowLeft, Users, ShieldCheck, Baby, Landmark, Upload, Copy } from "lucide-react";
import { Event, PaymentProvider, BANK_TRANSFER_DETAILS, ONLINE_PAYMENT_PROVIDERS } from "@/lib/types";
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
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [useAnonymous, setUseAnonymous] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Group admission — one ticket can admit a whole party (family events).
  // admitCount = adults + children + seniors; the gate sees the split.
  const [receiverName, setReceiverName] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [seniors, setSeniors] = useState(0);
  const [attendees, setAttendees] = useState<{ name: string; idNumber: string; ageGroup: string; address: string }[]>([]);
  const [step, setStep] = useState<"details" | "provider" | "bank_transfer" | "processing" | "redirect">("details");
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [txnReference, setTxnReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [bankCopied, setBankCopied] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [platformFee, setPlatformFee] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Each step ("details" -> "provider" -> "processing" -> "redirect") renders
  // very different content heights -- going from the tall provider list down
  // to the short "session ready" card left the page's old scroll position
  // sitting below the new, shorter content, which reads as "it jumped to the
  // bottom" (it didn't move; the page under it just got shorter). Pulling
  // the card into view on every step change keeps whatever's actionable
  // actually on screen regardless of how tall the previous step was.
  // Skip the very first run — effects fire on initial mount too, and there's
  // no prior step to have scrolled away from yet, so it was firing an
  // unwanted scroll the instant this form (and the page it's on) appeared.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step]);

  const selectedTicketType = event.ticketTypes.find((t) => t.id === selectedTicketTypeId);
  const available = selectedTicketType
    ? selectedTicketType.quantity - selectedTicketType.sold
    : 0;

  const basePrice = selectedTicketType ? selectedTicketType.price * quantity : 0;

  // The processing fee's rate is never sent to the browser (trade secret —
  // see memory: eticketzw-fee-secrecy). The server computes it and returns
  // only the resulting dollar amounts.
  useEffect(() => {
    if (basePrice <= 0) {
      setPlatformFee(0);
      setTotalPrice(0);
      return;
    }
    let cancelled = false;
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pass the chosen provider so bank transfer quotes include its
      // transaction cost on top of the platform fee.
      body: JSON.stringify({ subtotal: basePrice, provider: selectedProvider ?? undefined }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPlatformFee(Number(data.fee) || 0);
        setTotalPrice(Number(data.total) || basePrice);
      })
      .catch(() => {
        if (!cancelled) {
          setPlatformFee(0);
          setTotalPrice(basePrice);
        }
      });
    return () => { cancelled = true; };
  }, [basePrice, selectedProvider]);

  // Dev-only config reminder — a missing env var must never render as a
  // scary warning in a buyer's checkout on production.
  const showBaseUrlWarning =
    process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_BASE_URL;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= Math.min(available, 10)) {
      setQuantity(newQuantity);
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const getFieldError = (fieldName: string, value: string, isRequired: boolean) => {
    return isRequired && touched[fieldName] && !value ? "This field is required" : "";
  };

  const missingRequiredCustomField = (event.customFields ?? []).some(
    (f) => f.required && !customFieldValues[f.id]?.trim()
  );

  const admitCount = Math.max(1, adults + children + seniors);
  const hasKids = children > 0;
  // When kids under 18 are on the ticket, every attendee's details are
  // required — names, ID numbers, and a residential address. This is what
  // lets gate staff reunite a lost child with their party.
  const attendeesIncomplete = hasKids && attendees.some((a) => !a.name.trim() || !a.idNumber.trim() || !a.address.trim());

  // Keep the attendees array sized to the party — one row per person.
  useEffect(() => {
    if (!hasKids) { setAttendees([]); return; }
    setAttendees((prev) => {
      const next = Array.from({ length: admitCount }, (_, i) => {
        const ageGroup = i < adults ? "adult" : i < adults + children ? "child" : "senior";
        return prev[i] ? { ...prev[i], ageGroup } : { name: "", idNumber: "", ageGroup, address: "" };
      });
      return next;
    });
  }, [admitCount, hasKids, adults, children]);

  const handleDetailsSubmit = () => {
    if (!buyerName || !buyerContact || !buyerEmail || missingRequiredCustomField || attendeesIncomplete) return;
    setStep("provider");
    setPaymentError(null);
  };

  const handleProviderSelect = (providerId: string) => {
    const provider = ONLINE_PAYMENT_PROVIDERS.find((p) => p.id === providerId);
    if (provider && !provider.active) return;
    // Bank transfer has no hosted checkout — the buyer sees our FBC details,
    // pays at their bank, then submits proof + a transaction reference here.
    if (providerId === "bank_transfer") {
      setSelectedProvider("bank_transfer");
      setPaymentError(null);
      setStep("bank_transfer");
      return;
    }
    handlePaymentSubmit(providerId as PaymentProvider);
  };

  // Creates the on-hold order, then attaches the transaction reference and
  // proof of payment. The ticket is NOT issued here — an admin verifies the
  // deposit in the FBC account first.
  const handleBankTransferSubmit = async () => {
    if (!selectedTicketType || !txnReference.trim()) return;

    setStep("processing");
    setPaymentError(null);

    try {
      const response = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: `${event.title} - ${selectedTicketType.name} x ${quantity}`,
          amount: totalPrice,
          currency: selectedTicketType.currency,
          provider: "bank_transfer",
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
            receiverName: receiverName || undefined,
            admitCount,
            partyComposition: { adults, children, seniors },
            attendees: hasKids ? attendees : [],
            customFieldResponses: customFieldValues,
            platformFeeAmount: platformFee,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setPaymentError(data.error || "Could not create the bank transfer order. Please try again.");
        setStep("bank_transfer");
        return;
      }

      // Attach the transaction reference (+ proof file if provided) to the
      // on-hold order. Failure here isn't fatal — the confirmation page can
      // collect both again, so we still send the buyer there.
      const form = new FormData();
      form.append("transaction_reference", txnReference.trim());
      if (proofFile) form.append("proof", proofFile);
      await fetch(`/api/payments/bank-transfer/${encodeURIComponent(data.reference)}`, {
        method: "POST",
        body: form,
      }).catch(() => {});

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
          paymentMethod: "bank_transfer",
          totalPaid: totalPrice,
          currency: selectedTicketType.currency,
          purchasedAt: new Date().toISOString(),
        })
      );

      router.push(`/tickets/confirmation?ref=${data.reference}`);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Network error. Please try again."
      );
      setStep("bank_transfer");
    }
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
            receiverName: receiverName || undefined,
            admitCount,
            partyComposition: { adults, children, seniors },
            attendees: hasKids ? attendees : [],
            customFieldResponses: customFieldValues,
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
              : selectedProvider === "bank_transfer"
              ? "Creating your bank transfer order…"
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
          {step === "details"
            ? "Your Details"
            : step === "bank_transfer"
            ? "Pay by Bank Transfer"
            : "Select Payment Method"}
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
                  onBlur={() => handleFieldBlur("buyerName")}
                  placeholder="Enter your full name"
                  className={`mt-1.5 ${getFieldError("buyerName", buyerName, true) ? "border-destructive" : ""}`}
                />
                {getFieldError("buyerName", buyerName, true) && (
                  <p className="mt-1 text-xs text-destructive">{getFieldError("buyerName", buyerName, true)}</p>
                )}
              </div>
              <div>
                <Label htmlFor="buyerEmail">Email Address *</Label>
                <Input
                  id="buyerEmail"
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  onBlur={() => handleFieldBlur("buyerEmail")}
                  placeholder="you@example.com"
                  className={`mt-1.5 ${getFieldError("buyerEmail", buyerEmail, true) ? "border-destructive" : ""}`}
                />
                {getFieldError("buyerEmail", buyerEmail, true) && (
                  <p className="mt-1 text-xs text-destructive">{getFieldError("buyerEmail", buyerEmail, true)}</p>
                )}
              </div>
              <div>
                <Label htmlFor="buyerContact">Phone Number *</Label>
                <Input
                  id="buyerContact"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  onBlur={() => handleFieldBlur("buyerContact")}
                  placeholder="+263 7X XXX XXXX"
                  className={`mt-1.5 ${getFieldError("buyerContact", buyerContact, true) ? "border-destructive" : ""}`}
                />
                {getFieldError("buyerContact", buyerContact, true) && (
                  <p className="mt-1 text-xs text-destructive">{getFieldError("buyerContact", buyerContact, true)}</p>
                )}
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

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Label htmlFor="receiverName" className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Buying for someone else? Their name
                  <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Optional</span>
                </Label>
                <Input
                  id="receiverName"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Receiver's name (leave blank if it's for you)"
                  className="mt-1.5"
                />
                <p className="mt-1.5 text-xs font-medium text-primary/80">
                  Completely optional — you can stay anonymous. This is ONLY used to verify the right
                  person if the ticket ever gets lost.
                </p>
              </div>

              {/* Group admission — one ticket admitting a party (families).
                  The gate sees exactly how many adults/kids/seniors to let in. */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">How many people does this ticket admit?</p>
                </div>
                {([
                  { label: "Adults", value: adults, set: setAdults, min: 0 },
                  { label: "Children (under 18)", value: children, set: setChildren, min: 0 },
                  { label: "Seniors", value: seniors, set: setSeniors, min: 0 },
                ] as const).map(({ label, value, set, min }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => set(Math.max(min, value - 1))} disabled={value <= min}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{value}</span>
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => set(Math.min(20, value + 1))}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  This ticket admits <span className="font-semibold text-foreground">{admitCount}</span>{" "}
                  {admitCount === 1 ? "person" : "people"} at the gate.
                </p>
              </div>

              {hasKids && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Baby className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Children are on this ticket — we need every attendee&apos;s details. This is for
                      child safety: if a child gets separated at the event, staff can reunite them
                      with your party fast. Kids also get tagged wristbands at the gate.
                    </p>
                  </div>
                  {attendees.map((a, i) => (
                    <div key={i} className="space-y-2 rounded-md border bg-background p-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {a.ageGroup === "child" ? `Child ${i - adults + 1}` : a.ageGroup === "senior" ? `Senior ${i - adults - children + 1}` : `Adult ${i + 1}`}
                      </p>
                      <Input
                        value={a.name}
                        onChange={(e) => setAttendees((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        placeholder="Full name *"
                      />
                      <Input
                        value={a.idNumber}
                        onChange={(e) => setAttendees((prev) => prev.map((x, j) => j === i ? { ...x, idNumber: e.target.value } : x))}
                        placeholder={a.ageGroup === "child" ? "Birth certificate / ID number *" : "ID number *"}
                      />
                      <Input
                        value={a.address}
                        onChange={(e) => setAttendees((prev) => prev.map((x, j) => j === i ? { ...x, address: e.target.value } : x))}
                        placeholder="Residential address *"
                      />
                    </div>
                  ))}
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                      Required only because children are attending — kept private, used solely for
                      safety and admission management.
                    </p>
                  </div>
                </div>
              )}

              {(event.customFields ?? []).map((field) => {
                const fieldError = getFieldError(`cf-${field.id}`, customFieldValues[field.id] || "", field.required);
                return (
                  <div key={field.id}>
                    <Label htmlFor={`cf-${field.id}`}>
                      {field.label}
                      {field.required && " *"}
                    </Label>
                    {field.fieldType === "textarea" ? (
                      <Textarea
                        id={`cf-${field.id}`}
                        value={customFieldValues[field.id] || ""}
                        onChange={(e) => setCustomFieldValues((v) => ({ ...v, [field.id]: e.target.value }))}
                        onBlur={() => handleFieldBlur(`cf-${field.id}`)}
                        className={`mt-1.5 ${fieldError ? "border-destructive" : ""}`}
                      />
                    ) : field.fieldType === "select" ? (
                      <Select
                        value={customFieldValues[field.id] || ""}
                        onValueChange={(val) => setCustomFieldValues((v) => ({ ...v, [field.id]: val }))}
                      >
                        <SelectTrigger className={`mt-1.5 ${fieldError ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.fieldType === "checkbox" ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Checkbox
                          id={`cf-${field.id}`}
                          checked={customFieldValues[field.id] === "yes"}
                          onCheckedChange={(checked) =>
                            setCustomFieldValues((v) => ({ ...v, [field.id]: checked ? "yes" : "no" }))
                          }
                        />
                        <Label htmlFor={`cf-${field.id}`} className="text-sm font-normal cursor-pointer">Yes</Label>
                      </div>
                    ) : (
                      <Input
                        id={`cf-${field.id}`}
                        type={field.fieldType === "number" ? "number" : "text"}
                        value={customFieldValues[field.id] || ""}
                        onChange={(e) => setCustomFieldValues((v) => ({ ...v, [field.id]: e.target.value }))}
                        onBlur={() => handleFieldBlur(`cf-${field.id}`)}
                        className={`mt-1.5 ${fieldError ? "border-destructive" : ""}`}
                      />
                    )}
                    {fieldError && (
                      <p className="mt-1 text-xs text-destructive">{fieldError}</p>
                    )}
                  </div>
                );
              })}
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
              disabled={!buyerName || !buyerContact || !buyerEmail || missingRequiredCustomField || attendeesIncomplete}
            >
              Continue to Payment
            </Button>
          </>
        )}

        {/* ── Step 2b: Bank transfer — FBC details + proof/reference capture ── */}
        {step === "bank_transfer" && (
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

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Transfer {selectedTicketType.currency} ${totalPrice.toFixed(2)} to:</p>
              </div>
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Account Name</span>
                  <span className="text-right font-medium">{BANK_TRANSFER_DETAILS.accountName}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="text-right font-medium">{BANK_TRANSFER_DETAILS.bank}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Branch</span>
                  <span className="text-right font-medium">{BANK_TRANSFER_DETAILS.branch}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">USD Account</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono font-medium">{BANK_TRANSFER_DETAILS.accountNumber}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy account number"
                      onClick={() => {
                        navigator.clipboard.writeText(BANK_TRANSFER_DETAILS.accountNumber).then(() => {
                          setBankCopied(true);
                          setTimeout(() => setBankCopied(false), 2000);
                        }).catch(() => {});
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                {bankCopied && <p className="text-xs text-success">Account number copied</p>}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Use your order email or name as the payment narration. Your ticket is held until we
                verify the deposit — approval is done manually and you&apos;ll be notified by email and WhatsApp.
              </p>
              <p className="text-xs text-muted-foreground">
                Total includes the 5% bank transfer transaction cost.
              </p>
            </div>

            <div>
              <Label htmlFor="txnReference">Enter Transaction Reference *</Label>
              <Input
                id="txnReference"
                value={txnReference}
                onChange={(e) => setTxnReference(e.target.value)}
                placeholder="e.g. bank reference / transaction ID from your transfer"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                From your bank app, deposit slip or transfer confirmation — this is how we match your payment.
              </p>
            </div>

            <div>
              <Label htmlFor="proofFile" className="flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload Proof of Payment
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recommended</span>
              </Label>
              <Input
                id="proofFile"
                type="file"
                accept="*/*"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Any file format — receipt PDF, bank confirmation, or a screenshot/photo of your transfer.
                Proof speeds up verification.
              </p>
            </div>

            {paymentError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {paymentError}
              </div>
            )}

            <Button
              className="w-full gap-2 bg-primary hover:bg-primary/90"
              size="lg"
              onClick={handleBankTransferSubmit}
              disabled={!txnReference.trim()}
            >
              Submit Order for Verification
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { setStep("provider"); setPaymentError(null); }}
            >
              <ArrowLeft className="h-4 w-4" />
              Choose a Different Method
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
