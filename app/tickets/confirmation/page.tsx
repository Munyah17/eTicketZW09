"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Download,
  Share2,
  Ticket,
  User,
  Phone,
  CreditCard,
  Landmark,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BANK_TRANSFER_DETAILS } from "@/lib/types";

interface TicketData {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  ticketType: string;
  quantity: number;
  buyerName: string;
  buyerContact: string;
  displayName: string;
  paymentMethod: string;
  totalPaid: number;
  currency: string;
  purchasedAt: string;
}

interface PaymentStatusResponse {
  success: boolean;
  reference: string;
  provider: string;
  status: "pending" | "paid" | "failed" | "paid_refund_required" | "on_hold";
  reviewStatus: string | null;
  reviewReason: string | null;
  error: string | null;
  metadata: Record<string, any> | null;
  instruction: "accept" | "retry" | "pending";
  message: string;
}

function TicketConfirmationContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref");
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [shareMsg, setShareMsg] = useState("");
  // Bank-transfer resubmission — also covers buyers who skipped the upload
  // at checkout, or were asked for more information.
  const [txnRefInput, setTxnRefInput] = useState("");
  const [proofInput, setProofInput] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofMsg, setProofMsg] = useState("");

  const submitBankTransferInfo = async () => {
    if (!reference || (!txnRefInput.trim() && !proofInput)) return;
    setSubmittingProof(true);
    setProofMsg("");
    try {
      const form = new FormData();
      if (txnRefInput.trim()) form.append("transaction_reference", txnRefInput.trim());
      if (proofInput) form.append("proof", proofInput);
      const res = await fetch(`/api/payments/bank-transfer/${encodeURIComponent(reference)}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      setProofMsg(res.ok ? "Submitted — the verification team has been notified." : data.error || "Submission failed.");
      if (res.ok) { setTxnRefInput(""); setProofInput(null); }
    } catch {
      setProofMsg("Network error — please try again.");
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = ticketData
      ? `My ticket for ${ticketData.eventTitle} on ${ticketData.eventDate}`
      : "My E-TicketsZW ticket";
    try {
      if (navigator.share) {
        await navigator.share({ title: "E-TicketsZW Ticket", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link copied to clipboard");
      }
    } catch {
      // User dismissed the share sheet — not an error.
    }
    setTimeout(() => setShareMsg(""), 3000);
  };

  useEffect(() => {
    if (!reference) {
      setLoadingStatus(false);
      setStatusError("Missing payment reference. Unable to verify checkout result.");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    // EcoCash buyers land here while the PIN prompt is still on their phone,
    // and Stripe/Paynow buyers often arrive before the webhook does — one
    // status check would strand them on "pending" forever. Poll until a
    // terminal state (or ~5 minutes), then show the pending UI with a
    // manual refresh.
    const MAX_ATTEMPTS = 60;

    const fetchTicket = async (): Promise<boolean> => {
      try {
        const ticketResponse = await fetch(`/api/tickets/retrieve?ref=${encodeURIComponent(reference)}`);
        const ticketJson = await ticketResponse.json();
        if (ticketResponse.ok && ticketJson.ticket) {
          setTicketData(ticketJson.ticket as TicketData);
          return true;
        }
      } catch (error) {
        console.error("Failed to fetch ticket:", error);
      }
      return false;
    };

    const tick = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const response = await fetch(`/api/payments/status?ref=${encodeURIComponent(reference)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          if (attempts >= MAX_ATTEMPTS) {
            setStatusError(data.error || "Unable to load payment status.");
            setLoadingStatus(false);
            return;
          }
          timer = setTimeout(tick, 5000);
          return;
        }

        setPaymentStatus(data as PaymentStatusResponse);

        if (data.status === "paid") {
          if (await fetchTicket()) {
            setLoadingStatus(false);
            return;
          }
          // Payment paid but ticket still generating — keep polling on a
          // slightly longer budget; generation runs webhook-side.
          if (attempts >= MAX_ATTEMPTS + 6) {
            setLoadingStatus(false);
            return;
          }
          timer = setTimeout(tick, 5000);
          return;
        }

        // on_hold is terminal for polling purposes — only a human review
        // changes it, so show the review state and stop. (A stalled order
        // that gets resubmitted is reflected on the next page load/refresh.)
        if (data.status === "failed" || data.status === "paid_refund_required" || data.status === "on_hold") {
          setLoadingStatus(false);
          return;
        }

        // pending
        if (attempts >= MAX_ATTEMPTS) {
          setLoadingStatus(false);
          return;
        }
        timer = setTimeout(tick, 5000);
      } catch {
        if (attempts >= MAX_ATTEMPTS) {
          setStatusError("Unable to load payment status. Please check your connection and refresh.");
          setLoadingStatus(false);
          return;
        }
        timer = setTimeout(tick, 5000);
      }
    };

    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reference]);

  useEffect(() => {
    if (!ticketData) return;

    const qrData = JSON.stringify({
      ticketId: ticketData.id,
      eventId: ticketData.eventId,
      eventTitle: ticketData.eventTitle,
      ticketType: ticketData.ticketType,
      quantity: ticketData.quantity,
      buyerName: ticketData.buyerName,
      validationCode: `ETKT-${ticketData.id.slice(-8)}`,
    });

    QRCode.toDataURL(qrData, {
      width: 250,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then(setQrCodeUrl);
  }, [ticketData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-ZW", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      stripe: "Stripe (Card)",
      paynow: "Paynow",
      ecocash: "EcoCash",
      innbucks: "InnBucks",
      visa: "Visa Card",
      mastercard: "Mastercard",
      epay: "ePay",
      bank_transfer: "Bank Transfer",
    };
    return methods[method] || method;
  };

  if (loadingStatus) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Ticket className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-4 text-2xl font-bold">Checking Your Payment</h1>
            <p className="mt-2 text-muted-foreground">
              We are verifying your checkout result with the payment provider.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (statusError || !paymentStatus) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="max-w-lg rounded-3xl border border-destructive/20 bg-destructive/10 p-8 text-center">
            <Ticket className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Payment Status Unavailable</h1>
            <p className="mt-2 text-destructive">{statusError || "Unable to determine payment outcome."}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Please return to the checkout page and try again, or contact support if the issue persists.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/allevents">
                <Button variant="outline">Browse Events</Button>
              </Link>
              <Link href={`/tickets/confirmation?ref=${reference}`}>
                <Button>Retry</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isPaid = paymentStatus.status === "paid";
  const isPending = paymentStatus.status === "pending";
  const isRefundRequired = paymentStatus.status === "paid_refund_required";
  const isOnHold = paymentStatus.status === "on_hold";

  // Link back to the specific event so "Try Again" repeats the full checkout process
  const retryUrl = paymentStatus.metadata?.eventId
    ? `/events/${paymentStatus.metadata.eventId}`
    : "/allevents";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
          {isPaid ? (
            ticketData ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <h1 className="mt-4 text-2xl font-bold">Payment Successful!</h1>
                  <p className="mt-2 text-muted-foreground">
                    Your ticket has been confirmed. Present the QR code at the venue for entry.
                  </p>
                </div>

                <Card className="mt-8 overflow-hidden">
                  <div className="bg-primary p-4 text-primary-foreground">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-5 w-5" />
                        <span className="font-heading font-semibold">E-TicketsZW</span>
                      </div>
                      <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
                        {ticketData.ticketType}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold">{ticketData.eventTitle}</h2>

                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(ticketData.eventDate)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatTime(ticketData.eventTime)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{ticketData.venue}</span>
                      </div>
                    </div>

                    <div className="my-6 border-t border-dashed" />

                    <div className="flex flex-col items-center">
                      {qrCodeUrl && (
                        <img
                          src={qrCodeUrl}
                          alt="Ticket QR Code"
                          className="h-[200px] w-[200px] rounded-lg border p-2"
                        />
                      )}
                      <p className="mt-2 text-xs font-mono text-muted-foreground">Ticket reference: {ticketData.id}</p>
                      <p className="mt-1 text-sm font-medium">
                        Quantity: {ticketData.quantity} {ticketData.quantity > 1 ? "tickets" : "ticket"}
                      </p>
                    </div>

                    <div className="my-6 border-t border-dashed" />

                    <div className="space-y-3">
                      <h3 className="font-semibold">Ticket Holder</h3>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{ticketData.displayName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{ticketData.buyerContact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">
                            Paid ${ticketData.totalPaid.toFixed(2)} via {getPaymentMethodLabel(ticketData.paymentMethod)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`/api/tickets/${ticketData.id}/download?ref=${encodeURIComponent(reference ?? "")}`}
                    download={`ticket-${ticketData.id}.png`}
                    className="flex-1"
                  >
                    <Button className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Download Ticket (PNG)
                    </Button>
                  </a>
                  <a
                    href={`/api/tickets/${ticketData.id}/wristband?ref=${encodeURIComponent(reference ?? "")}`}
                    download={`wristband-${ticketData.id}.png`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Print Wristband
                    </Button>
                  </a>
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
                {shareMsg && <p className="mt-2 text-center text-sm text-success">{shareMsg}</p>}
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Gate staff will have your wristband ready at the venue — printing your own is optional.
                </p>
              </>
            ) : (
              <div className="rounded-3xl border border-success/20 bg-success/10 p-8 text-center">
                <Ticket className="mx-auto h-16 w-16 text-success" />
                <h1 className="mt-4 text-2xl font-bold">Payment Confirmed</h1>
                <p className="mt-2 text-muted-foreground">
                  The payment was accepted. Your ticket will be generated and available shortly.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button onClick={() => window.location.reload()}>Refresh</Button>
                  <Link href="/allevents">
                    <Button variant="outline">Browse Events</Button>
                  </Link>
                </div>
              </div>
            )
          ) : isRefundRequired ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
              <Ticket className="mx-auto h-16 w-16 text-amber-600" />
              <h1 className="mt-4 text-2xl font-bold">Payment Received — Refund Required</h1>
              <p className="mt-2 text-amber-800">
                Your payment went through, but the ticket sold out before it could be issued.
                Your payment will be refunded — please contact support if you have questions.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact">
                  <Button>Contact Support</Button>
                </Link>
                <Link href="/allevents">
                  <Button variant="outline">Browse Events</Button>
                </Link>
              </div>
            </div>
          ) : isOnHold ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
                <Landmark className="mx-auto h-16 w-16 text-amber-600" />
                <h1 className="mt-4 text-2xl font-bold">
                  {paymentStatus.reviewStatus === "info_requested"
                    ? "More Information Needed"
                    : "Order On Hold — Awaiting Verification"}
                </h1>
                <p className="mt-2 text-amber-800">
                  {paymentStatus.reviewStatus === "info_requested"
                    ? "We reviewed your bank transfer but need more information before we can approve it:"
                    : "Your ticket is not issued yet — it will be sent by email and WhatsApp once our team verifies your deposit in the FBC account."}
                </p>
                {paymentStatus.reviewStatus === "info_requested" && paymentStatus.reviewReason && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-white p-3 text-sm font-medium text-amber-900">
                    {paymentStatus.reviewReason}
                  </p>
                )}
                {paymentStatus.metadata?.transaction_reference && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Transaction reference on file: <span className="font-mono">{paymentStatus.metadata.transaction_reference}</span>
                  </p>
                )}
              </div>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Payment should have gone to</h3>
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
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">USD Account</span>
                      <span className="text-right font-mono font-medium">{BANK_TRANSFER_DETAILS.accountNumber}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">
                      {paymentStatus.reviewStatus === "info_requested"
                        ? "Resubmit your details"
                        : "Add or update your proof of payment"}
                    </p>
                    <div>
                      <Label htmlFor="txnRef">Transaction Reference</Label>
                      <Input
                        id="txnRef"
                        value={txnRefInput}
                        onChange={(e) => setTxnRefInput(e.target.value)}
                        placeholder="Bank transaction reference"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="proof" className="flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" /> Proof of Payment
                      </Label>
                      <Input
                        id="proof"
                        type="file"
                        accept="*/*"
                        onChange={(e) => setProofInput(e.target.files?.[0] ?? null)}
                        className="mt-1.5"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Any file format — PDF, screenshot, or photo.</p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={submitBankTransferInfo}
                      disabled={submittingProof || (!txnRefInput.trim() && !proofInput)}
                    >
                      {submittingProof ? "Submitting…" : "Submit for Review"}
                    </Button>
                    {proofMsg && <p className="text-center text-sm text-muted-foreground">{proofMsg}</p>}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 sm:flex-row justify-center">
                <Button onClick={() => window.location.reload()}>Refresh Status</Button>
                <Link href="/allevents">
                  <Button variant="outline">Browse Events</Button>
                </Link>
              </div>
            </div>
          ) : isPending ? (
            <div className="rounded-3xl border border-muted/20 bg-secondary/50 p-8 text-center">
              <Ticket className="mx-auto h-16 w-16 text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-bold">Payment Pending</h1>
              <p className="mt-2 text-muted-foreground">
                {paymentStatus.provider === "ecocash"
                  ? "Check your phone for the EcoCash PIN prompt and confirm the payment — this page will update automatically."
                  : "Your payment is still being confirmed. This page will keep checking — you can also refresh."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => window.location.reload()}>Refresh Status</Button>
                <Link href="/allevents">
                  <Button variant="outline">Browse Events</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-8 text-center">
              <Ticket className="mx-auto h-16 w-16 text-destructive" />
              <h1 className="mt-4 text-2xl font-bold">
                {paymentStatus.provider === "bank_transfer" ? "Bank Transfer Rejected" : "Payment Was Not Successful"}
              </h1>
              <p className="mt-2 text-destructive">
                {paymentStatus.provider === "bank_transfer"
                  ? "We could not verify your bank transfer."
                  : "Your payment did not go through. Would you like to try again or use a different payment method?"}
              </p>
              {paymentStatus.provider === "bank_transfer" && paymentStatus.reviewReason && (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-white p-3 text-sm font-medium text-destructive">
                  Reason: {paymentStatus.reviewReason}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/allevents">
                  <Button variant="outline">Browse Events</Button>
                </Link>
                <Link href={retryUrl}>
                  <Button>Try Again</Button>
                </Link>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/allevents">
              <Button variant="outline">Browse More Events</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function TicketConfirmationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <TicketConfirmationContent />
    </Suspense>
  );
}
