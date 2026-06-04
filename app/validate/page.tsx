"use client";

import { useState } from "react";
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
} from "lucide-react";
import { mockTickets } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type ValidationStatus = "idle" | "scanning" | "valid" | "invalid" | "used";

interface ValidationResult {
  status: ValidationStatus;
  ticket?: typeof mockTickets[0];
  message?: string;
}

export default function ValidatePage() {
  const [ticketCode, setTicketCode] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    status: "idle",
  });
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async () => {
    if (!ticketCode.trim()) return;

    setIsValidating(true);
    setValidationResult({ status: "scanning" });

    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock validation logic
    const ticket = mockTickets.find(
      (t) =>
        t.id.toLowerCase() === ticketCode.toLowerCase() ||
        t.qrCode.toLowerCase() === ticketCode.toLowerCase()
    );

    if (ticket) {
      if (ticket.validated) {
        setValidationResult({
          status: "used",
          ticket,
          message: `This ticket was already validated on ${new Date(
            ticket.validatedAt!
          ).toLocaleString()}`,
        });
      } else {
        setValidationResult({
          status: "valid",
          ticket,
          message: "Ticket is valid! Allow entry.",
        });
      }
    } else {
      setValidationResult({
        status: "invalid",
        message: "Invalid ticket code. Please check and try again.",
      });
    }

    setIsValidating(false);
  };

  const handleReset = () => {
    setTicketCode("");
    setValidationResult({ status: "idle" });
  };

  const handleMarkAsUsed = () => {
    if (validationResult.ticket) {
      setValidationResult({
        ...validationResult,
        status: "used",
        message: "Ticket has been marked as validated.",
      });
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      ecocash: "EcoCash",
      innbucks: "InnBucks",
      visa: "Visa Card",
      mastercard: "Mastercard",
    };
    return methods[method] || method;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 bg-secondary/30">
        <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Ticket Validation</h1>
            <p className="mt-2 text-muted-foreground">
              Scan or enter a ticket code to validate entry
            </p>
          </div>

          {/* Validation Form */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Enter Ticket Code</CardTitle>
              <CardDescription>
                Type the ticket ID or scan the QR code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ticketCode">Ticket Code</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="ticketCode"
                    value={ticketCode}
                    onChange={(e) => setTicketCode(e.target.value)}
                    placeholder="e.g., TKT-123456 or ETKT-001-GHT24-MB-TM"
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

              {/* Demo Codes */}
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Demo codes to try:</strong> tkt-001, tkt-002, ETKT-001-GHT24-MB-TM
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Validation Result */}
          {validationResult.status !== "idle" && (
            <Card
              className={cn(
                "mt-6 overflow-hidden",
                validationResult.status === "valid" && "border-success",
                validationResult.status === "invalid" && "border-destructive",
                validationResult.status === "used" && "border-warning"
              )}
            >
              {/* Status Header */}
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

              {/* Ticket Details */}
              {validationResult.ticket && (
                <CardContent className="p-6 space-y-6">
                  {/* Event Info */}
                  <div>
                    <h3 className="text-lg font-semibold">
                      {validationResult.ticket.eventTitle}
                    </h3>
                    <div className="mt-3 grid gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.eventDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.eventTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.venue}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket Type */}
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <Badge>{validationResult.ticket.ticketTypeName}</Badge>
                  </div>

                  {/* Buyer Info */}
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium">Ticket Holder</h4>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.buyerDisplayName}</span>
                        {validationResult.ticket.buyerDisplayName !==
                          validationResult.ticket.buyerName && (
                          <span className="text-muted-foreground">
                            ({validationResult.ticket.buyerName})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{validationResult.ticket.buyerContact}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>
                          ${validationResult.ticket.totalPaid.toFixed(2)} via{" "}
                          {getPaymentMethodLabel(validationResult.ticket.paymentMethod)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
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

                  {/* Actions */}
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

              {/* Invalid Ticket Message */}
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

          {/* Instructions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">How to Validate Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    1
                  </span>
                  <span>
                    Ask the attendee to show their ticket QR code or provide their ticket ID
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    2
                  </span>
                  <span>
                    Enter the ticket code in the field above and click Validate
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    3
                  </span>
                  <span>
                    Verify the ticket details match the attendee (name, ticket type)
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    4
                  </span>
                  <span>
                    If valid, click &quot;Mark as Validated&quot; to register entry
                  </span>
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
