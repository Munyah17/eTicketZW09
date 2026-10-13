"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Ticket,
  CreditCard,
  RefreshCw,
  ShieldAlert,
  Camera,
  IdCard,
  Users,
  Baby,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type ValidationStatus = "idle" | "scanning" | "valid" | "invalid" | "used";

interface AttendeeRow {
  name: string;
  idNumber?: string;
  ageGroup?: string;
  address?: string;
}

interface TicketRow {
  id: string;
  event_title: string;
  event_date: string;
  event_time: string;
  venue: string;
  ticket_type_name: string;
  buyer_display_name: string;
  buyer_name: string;
  buyer_contact: string;
  id_number?: string;
  receiver_name?: string | null;
  ticket_number?: string | null;
  batch_id?: string | null;
  admit_count?: number;
  party_composition?: { adults?: number; children?: number; seniors?: number };
  attendees?: AttendeeRow[];
  total_paid: number;
  payment_method: string;
  validated?: boolean;
  validated_at?: string;
}

interface ValidationResult {
  status: ValidationStatus;
  ticket?: TicketRow;
  message?: string;
}

const AUTHORIZED_ROLES = new Set(["admin", "super_admin", "organizer", "staff"]);

interface PublicCheckResult {
  status: "valid" | "used" | "invalid";
  message: string;
  ticket?: {
    id: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    ticketTypeName: string;
    seatNumber?: string | null;
    holder?: string;
  };
}

export default function ValidatePage() {
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const [ticketCode, setTicketCode] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: "idle" });
  const [isValidating, setIsValidating] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [codeParam, setCodeParam] = useState<string | null>(null);
  const [batchParam, setBatchParam] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{ batchId: string; tickets: TicketRow[] } | null>(null);
  const [publicCheck, setPublicCheck] = useState<PublicCheckResult | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<{ stop: () => void } | null>(null);
  const autoLookupDone = useRef(false);

  // Ticket QR codes encode /validate?code=<ticket-id>; batch barcodes encode
  // /validate?batch=<batch-id>. Read both on mount (plain window.location to
  // keep the page statically prerenderable).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const batch = params.get("batch");
    if (code) setCodeParam(code);
    if (batch) setBatchParam(batch);
  }, []);

  // Re-focus the code field after every scan/reset so an external USB/Bluetooth
  // barcode-scanner "gun" (which just types + Enter) always has somewhere to type.
  useEffect(() => {
    // preventScroll — without it, the browser's native "scroll focused
    // element into view" jumped the whole page down to this field on every
    // mount/refocus, since it sits below other page content.
    if (!isCameraOpen) codeInputRef.current?.focus({ preventScroll: true });
  }, [validationResult.status, isCameraOpen]);

  const runBatchLookup = useCallback(async (batchId: string) => {
    if (!batchId.trim()) return;
    setIsValidating(true);
    setValidationResult({ status: "scanning" });
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup_batch", batchId: batchId.trim() }),
      });
      const json = await res.json();
      if (json.status === "batch") {
        setBatchResult({ batchId: batchId.trim(), tickets: json.tickets });
        setValidationResult({ status: "idle" });
      } else {
        setValidationResult({ status: "invalid", message: json.message });
      }
    } finally {
      setIsValidating(false);
    }
  }, []);

  const runLookup = useCallback(async (code: string) => {
    if (!code.trim()) return;

    // A scanned batch barcode arrives as the batch URL — route it to the
    // batch flow instead of the single-ticket lookup.
    const batchMatch = code.match(/[?&]batch=([0-9a-fA-F-]{36})/);
    if (batchMatch) {
      runBatchLookup(batchMatch[1]);
      return;
    }

    setIsValidating(true);
    setValidationResult({ status: "scanning" });

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", code: code.trim() }),
      });
      const json = await res.json();
      setValidationResult({
        status: json.status === "invalid" ? "invalid" : json.status,
        ticket: json.ticket,
        message: json.message,
      });
    } finally {
      setIsValidating(false);
    }
  }, [runBatchLookup]);

  const handleValidate = () => runLookup(ticketCode);

  // Arriving via a scanned QR: staff get the code pre-filled and looked up
  // automatically; everyone else gets a read-only public confirmation check.
  const isStaff = !authLoading && isLoggedIn && !!user && AUTHORIZED_ROLES.has(user.role);
  useEffect(() => {
    if (authLoading || autoLookupDone.current) return;
    if (!codeParam && !batchParam) return;
    autoLookupDone.current = true;
    if (isStaff) {
      if (batchParam) {
        runBatchLookup(batchParam);
      } else if (codeParam) {
        setTicketCode(codeParam);
        runLookup(codeParam);
      }
    } else if (codeParam) {
      fetch(`/api/tickets/check?code=${encodeURIComponent(codeParam)}`)
        .then((res) => res.json())
        .then((json) => setPublicCheck(json))
        .catch(() => setPublicCheck({ status: "invalid", message: "Could not check this ticket. Please try again." }));
    }
  }, [codeParam, batchParam, authLoading, isStaff, runLookup, runBatchLookup]);

  const handleReset = () => {
    setTicketCode("");
    setValidationResult({ status: "idle" });
    setBatchResult(null);
  };

  const handleMarkAsUsed = async () => {
    if (!validationResult.ticket) return;
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_used", ticketId: validationResult.ticket.id }),
    });
    const json = await res.json();
    setValidationResult({ status: "used", ticket: json.ticket, message: json.message });
  };

  // Admit one ticket inside a batch result — updates that row in place.
  const handleAdmitBatchTicket = async (ticketId: string) => {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_used", ticketId }),
    });
    const json = await res.json();
    if (json.ticket) {
      setBatchResult((prev) => prev && ({
        ...prev,
        tickets: prev.tickets.map((t) => (t.id === ticketId ? json.ticket : t)),
      }));
    }
  };

  // Admit every remaining ticket in the batch — the family-arrives-together
  // fast path.
  const handleAdmitAllBatch = async () => {
    if (!batchResult) return;
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_batch_used", batchId: batchResult.batchId }),
    });
    const json = await res.json();
    if (json.tickets) {
      const admitted = new Map((json.tickets as TicketRow[]).map((t) => [t.id, t]));
      setBatchResult((prev) => prev && ({
        ...prev,
        tickets: prev.tickets.map((t) => admitted.get(t.id) ?? { ...t, validated: true }),
      }));
    }
  };

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    setIsCameraOpen(false);
  }, []);

  const startCamera = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("validate-qr-reader");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop();
          cameraRef.current = null;
          setIsCameraOpen(false);
          setTicketCode(decodedText);
          runLookup(decodedText);
        },
        () => {}
      );
      cameraRef.current = { stop: () => scanner.stop() };
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Failed to start camera:", err);
      alert("Failed to access camera. Please check permissions, or enter the code manually.");
    }
  };

  useEffect(() => {
    return () => { cameraRef.current?.stop(); };
  }, []);

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      ecocash: "EcoCash",
      innbucks: "InnBucks",
      visa: "Visa Card",
      mastercard: "Mastercard",
    };
    return methods[method] || method;
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isLoggedIn || !user || !AUTHORIZED_ROLES.has(user.role)) {
    // Public confirmation check — someone scanned a ticket QR with a phone
    // camera. Show read-only authenticity status; admission stays staff-only.
    if (codeParam) {
      const pc = publicCheck;
      return (
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex flex-1 items-center justify-center bg-secondary/30">
            <div className="w-full max-w-md px-4 py-10">
              <Card>
                <CardHeader className="text-center">
                  <div
                    className={cn(
                      "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                      !pc ? "bg-muted" : pc.status === "valid" ? "bg-success/10" : pc.status === "used" ? "bg-warning/10" : "bg-destructive/10"
                    )}
                  >
                    {!pc ? (
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : pc.status === "valid" ? (
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    ) : pc.status === "used" ? (
                      <AlertCircle className="h-8 w-8 text-warning" />
                    ) : (
                      <XCircle className="h-8 w-8 text-destructive" />
                    )}
                  </div>
                  <CardTitle className="mt-3">
                    {!pc
                      ? "Checking ticket…"
                      : pc.status === "valid"
                      ? "Genuine Ticket"
                      : pc.status === "used"
                      ? "Ticket Already Used"
                      : "Invalid Ticket"}
                  </CardTitle>
                  {pc && <CardDescription>{pc.message}</CardDescription>}
                </CardHeader>
                {pc?.ticket && (
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Event</span>
                      <span className="font-medium text-right">{pc.ticket.eventTitle}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium text-right">{pc.ticket.eventDate} · {pc.ticket.eventTime}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Venue</span>
                      <span className="font-medium text-right">{pc.ticket.venue}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Ticket Type</span>
                      <span className="font-medium text-right">{pc.ticket.ticketTypeName}</span>
                    </div>
                    {pc.ticket.seatNumber && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Seat</span>
                        <span className="font-medium text-right">{pc.ticket.seatNumber}</span>
                      </div>
                    )}
                    <p className="pt-3 text-xs text-muted-foreground">
                      This is a read-only authenticity check by E-TicketsZW. Entry admission is done by event staff at the gate.
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
          </main>
          <Footer />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="max-w-md text-center px-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Staff Access Required</h1>
            <p className="mt-2 text-muted-foreground">
              Ticket validation is restricted to authorized staff, organizer, and admin accounts.
            </p>
            <Link href="/login" className="mt-6 inline-block">
              <Button>Sign In</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-secondary/30">
        <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Ticket Validation</h1>
            <p className="mt-2 text-muted-foreground">
              Scan or enter a ticket code to validate entry
            </p>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Enter Ticket Code</CardTitle>
              <CardDescription>
                Type the ticket ID, scan with a phone camera, or use a handheld/external scanner — it types
                into the field below automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCameraOpen ? (
                <div className="space-y-3">
                  <div id="validate-qr-reader" className="mx-auto w-full max-w-sm aspect-square overflow-hidden rounded-lg bg-muted" />
                  <Button variant="outline" className="w-full" onClick={stopCamera}>
                    Cancel Camera Scan
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2" onClick={startCamera}>
                  <Camera className="h-4 w-4" />
                  Scan with Phone Camera
                </Button>
              )}

              <div>
                <Label htmlFor="ticketCode">Ticket Code</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="ticketCode"
                    ref={codeInputRef}
                    value={ticketCode}
                    onChange={(e) => setTicketCode(e.target.value)}
                    placeholder="Ready to scan — or type the ticket ID"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleValidate();
                    }}
                  />
                  <Button
                    onClick={handleValidate}
                    disabled={isValidating || !ticketCode.trim()}
                    className="gap-2"
                  >
                    {isValidating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Validate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {validationResult.status !== "idle" && (
            <Card
              className={cn(
                "mt-6 overflow-hidden",
                validationResult.status === "valid" && "border-success",
                validationResult.status === "invalid" && "border-destructive",
                validationResult.status === "used" && "border-warning"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3 p-4",
                  validationResult.status === "scanning" && "bg-primary/10",
                  validationResult.status === "valid" && "bg-success/10",
                  validationResult.status === "invalid" && "bg-destructive/10",
                  validationResult.status === "used" && "bg-warning/10"
                )}
              >
                {validationResult.status === "scanning" && (
                  <>
                    <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                    <span className="font-semibold text-primary">Validating...</span>
                  </>
                )}
                {validationResult.status === "valid" && (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    <span className="font-semibold text-success">Valid Ticket</span>
                  </>
                )}
                {validationResult.status === "invalid" && (
                  <>
                    <XCircle className="h-6 w-6 text-destructive" />
                    <span className="font-semibold text-destructive">Invalid Ticket</span>
                  </>
                )}
                {validationResult.status === "used" && (
                  <>
                    <AlertCircle className="h-6 w-6 text-warning" />
                    <span className="font-semibold text-warning">Already Validated</span>
                  </>
                )}
              </div>

              {validationResult.ticket && (
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">{validationResult.ticket.event_title}</h3>
                    <div className="mt-3 grid gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.event_date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.event_time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.venue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <Badge>{validationResult.ticket.ticket_type_name}</Badge>
                    {validationResult.ticket.ticket_number && (
                      <Badge variant="outline" className="font-mono">
                        {validationResult.ticket.ticket_number}
                      </Badge>
                    )}
                  </div>

                  {/* Group admission — the gate needs the headcount and the
                      adults/kids/seniors split at a glance. */}
                  {(validationResult.ticket.admit_count ?? 1) > 1 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 font-medium">
                        <Users className="h-4 w-4 text-primary" />
                        Admits {validationResult.ticket.admit_count} people
                      </div>
                      {validationResult.ticket.party_composition && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[
                            validationResult.ticket.party_composition.adults ? `${validationResult.ticket.party_composition.adults} adult(s)` : null,
                            validationResult.ticket.party_composition.children ? `${validationResult.ticket.party_composition.children} child(ren)` : null,
                            validationResult.ticket.party_composition.seniors ? `${validationResult.ticket.party_composition.seniors} senior(s)` : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {(validationResult.ticket.attendees?.length ?? 0) > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
                            <Baby className="h-3.5 w-3.5" />
                            Attendee list (children on ticket — verify each name)
                          </div>
                          {validationResult.ticket.attendees!.map((a, i) => (
                            <div key={i} className="rounded-md border bg-background px-3 py-2 text-xs">
                              <span className="font-medium">{a.name}</span>
                              <span className="text-muted-foreground">
                                {" · "}{a.ageGroup}{a.idNumber ? ` · ID ${a.idNumber}` : ""}{a.address ? ` · ${a.address}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium">Ticket Holder</h4>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.buyer_display_name}</span>
                        {validationResult.ticket.buyer_display_name !== validationResult.ticket.buyer_name && (
                          <span className="text-muted-foreground">({validationResult.ticket.buyer_name})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.buyer_contact}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        <span>ID Number: {validationResult.ticket.id_number || "Not provided"}</span>
                      </div>
                      {validationResult.ticket.receiver_name && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Receiver: {validationResult.ticket.receiver_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>
                          ${Number(validationResult.ticket.total_paid).toFixed(2)} via{" "}
                          {getPaymentMethodLabel(validationResult.ticket.payment_method)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {validationResult.message && (
                    <p
                      className={cn(
                        "text-sm font-medium",
                        validationResult.status === "valid" && "text-success",
                        validationResult.status === "used" && "text-warning"
                      )}
                    >
                      {validationResult.message}
                    </p>
                  )}

                  <div className="flex gap-3">
                    {validationResult.status === "valid" && (
                      <Button
                        onClick={handleMarkAsUsed}
                        className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Validated
                      </Button>
                    )}
                    <Button variant="outline" onClick={handleReset} className="flex-1">
                      Validate Another
                    </Button>
                  </div>
                </CardContent>
              )}

              {validationResult.status === "invalid" && (
                <CardContent className="p-6">
                  <p className="text-muted-foreground">{validationResult.message}</p>
                  <Button onClick={handleReset} className="mt-4 w-full">
                    Try Again
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Batch result — one barcode scan pulled up every ticket in
              the purchase; each admits individually or all at once ── */}
          {batchResult && (
            <Card className="mt-6 border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Batch — {batchResult.tickets.length} ticket(s) in this order
                </CardTitle>
                <CardDescription>
                  Admit each person as they arrive, or admit everyone remaining at once.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {batchResult.tickets.map((t) => (
                  <div key={t.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.buyer_display_name || t.buyer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.ticket_type_name}
                          {t.ticket_number ? ` · ${t.ticket_number}` : ""}
                          {t.receiver_name ? ` · for ${t.receiver_name}` : ""}
                        </p>
                      </div>
                      {t.validated ? (
                        <Badge variant="outline" className="border-warning text-warning">Admitted</Badge>
                      ) : (
                        <Button size="sm" onClick={() => handleAdmitBatchTicket(t.id)} className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Admit{(t.admit_count ?? 1) > 1 ? ` ${t.admit_count}` : ""}
                        </Button>
                      )}
                    </div>
                    {(t.admit_count ?? 1) > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Admits {t.admit_count}
                        {t.party_composition && ` — ${[
                          t.party_composition.adults ? `${t.party_composition.adults} adult(s)` : null,
                          t.party_composition.children ? `${t.party_composition.children} child(ren)` : null,
                          t.party_composition.seniors ? `${t.party_composition.seniors} senior(s)` : null,
                        ].filter(Boolean).join(", ")}`}
                      </p>
                    )}
                    {(t.attendees?.length ?? 0) > 0 && (
                      <div className="space-y-1">
                        {t.attendees!.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {a.name} · {a.ageGroup}{a.idNumber ? ` · ID ${a.idNumber}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex gap-3 pt-1">
                  {batchResult.tickets.some((t) => !t.validated) && (
                    <Button onClick={handleAdmitAllBatch} className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      Admit All Remaining
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleReset} className="flex-1">
                    Done — Validate Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">How to Validate Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
                  <span>Ask the attendee to show their ticket QR code or provide their ticket ID</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
                  <span>Enter the ticket code in the field above and click Validate</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
                  <span>Verify the ticket details match the attendee (name, ticket type)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">4</span>
                  <span>If valid, click &quot;Mark as Validated&quot; to register entry</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
