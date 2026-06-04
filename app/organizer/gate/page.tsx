"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  QrCode,
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ticket,
  Search,
  UserCheck,
  Ban,
} from "lucide-react";
import { mockEvents, mockTickets } from "@/lib/mock-data";
import { Ticket as TicketType } from "@/lib/types";

type ScanResult = {
  status: "valid" | "invalid" | "admitted" | "not_found";
  ticket?: TicketType;
  message: string;
};

export default function GateManagementPage() {
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [tickets, setTickets] = useState<TicketType[]>(mockTickets);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  const organizerEvents = mockEvents.filter(
    (e) => e.organizerId === "org-001" && e.status === "published"
  );

  const eventTickets = tickets.filter((t) => t.eventId === selectedEvent);
  const admittedCount = eventTickets.filter((t) => t.isAdmitted).length;
  const validCount = eventTickets.filter(
    (t) => t.paymentStatus === "completed" && !t.isAdmitted
  ).length;

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("qr-reader");
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScan(decodedText);
          html5QrCode.stop();
          setIsScanning(false);
        },
        () => {}
      );
      
      scannerRef.current = { stop: () => html5QrCode.stop() };
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      alert("Failed to access camera. Please check permissions.");
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
    };
  }, []);

  const handleScan = (code: string) => {
    const ticket = tickets.find(
      (t) => t.qrCode === code && t.eventId === selectedEvent
    );

    if (!ticket) {
      setScanResult({
        status: "not_found",
        message: "Ticket not found or not valid for this event",
      });
    } else if (ticket.isAdmitted) {
      setScanResult({
        status: "admitted",
        ticket,
        message: `Already admitted at ${new Date(
          ticket.admittedAt!
        ).toLocaleTimeString()}`,
      });
    } else if (ticket.paymentStatus !== "completed") {
      setScanResult({
        status: "invalid",
        ticket,
        message: "Payment not completed",
      });
    } else {
      setScanResult({
        status: "valid",
        ticket,
        message: "Valid ticket - Ready for admission",
      });
    }

    setDialogOpen(true);
  };

  const handleManualSearch = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode("");
    }
  };

  const handleAdmit = () => {
    if (scanResult?.ticket) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === scanResult.ticket!.id
            ? {
                ...t,
                isAdmitted: true,
                admittedAt: new Date().toISOString(),
                admittedBy: "gate-staff",
              }
            : t
        )
      );
      setScanResult({
        ...scanResult,
        status: "admitted",
        message: "Successfully admitted!",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gate Management</h1>
        <p className="text-muted-foreground mt-1">
          Validate and admit ticket holders at the gate
        </p>
      </div>

      {/* Event Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Event</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose an event to manage" />
            </SelectTrigger>
            <SelectContent>
              {organizerEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title} - {new Date(event.date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tickets</p>
                    <p className="text-2xl font-bold">{eventTickets.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <UserCheck className="h-6 w-6 text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admitted</p>
                    <p className="text-2xl font-bold">{admittedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <Ticket className="h-6 w-6 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Entry</p>
                    <p className="text-2xl font-bold">{validCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scanner Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* QR Scanner */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  QR Code Scanner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  id="qr-reader"
                  className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
                >
                  {!isScanning && (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                      <QrCode className="h-16 w-16 mb-4" />
                      <p>Click Start to begin scanning</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isScanning ? (
                    <Button onClick={startScanner} className="flex-1">
                      <Camera className="h-4 w-4 mr-2" />
                      Start Scanner
                    </Button>
                  ) : (
                    <Button
                      onClick={stopScanner}
                      variant="destructive"
                      className="flex-1"
                    >
                      Stop Scanner
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Manual Ticket Lookup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ticket-code">Ticket Code</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="ticket-code"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Enter ticket code..."
                      onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                    />
                    <Button onClick={handleManualSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Quick Test Codes</h4>
                  <div className="space-y-2">
                    {eventTickets.slice(0, 3).map((ticket) => (
                      <Button
                        key={ticket.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left"
                        onClick={() => handleScan(ticket.qrCode)}
                      >
                        <code className="text-xs">{ticket.qrCode}</code>
                        {ticket.isAdmitted && (
                          <span className="ml-auto text-xs text-amber-600">
                            Admitted
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Scans */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Admissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {eventTickets
                  .filter((t) => t.isAdmitted)
                  .slice(0, 10)
                  .map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{ticket.buyerDisplayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {ticket.ticketTypeName} - {ticket.qrCode}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Admitted
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {ticket.admittedAt &&
                            new Date(ticket.admittedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                {eventTickets.filter((t) => t.isAdmitted).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No admissions yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Scan Result Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResult?.status === "valid" && (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  Valid Ticket
                </>
              )}
              {scanResult?.status === "admitted" && (
                <>
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                  Already Admitted
                </>
              )}
              {scanResult?.status === "invalid" && (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  Invalid Ticket
                </>
              )}
              {scanResult?.status === "not_found" && (
                <>
                  <Ban className="h-6 w-6 text-red-600" />
                  Not Found
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p
              className={`text-lg font-medium ${
                scanResult?.status === "valid"
                  ? "text-green-600"
                  : scanResult?.status === "admitted"
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {scanResult?.message}
            </p>

            {scanResult?.ticket && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p>
                  <strong>Name:</strong> {scanResult.ticket.buyerDisplayName}
                </p>
                <p>
                  <strong>Contact:</strong> {scanResult.ticket.buyerContact}
                </p>
                <p>
                  <strong>Ticket Type:</strong> {scanResult.ticket.ticketTypeName}
                </p>
                <p>
                  <strong>Amount Paid:</strong> ${scanResult.ticket.totalPaid}{" "}
                  {scanResult.ticket.currency}
                </p>
                <p>
                  <strong>Payment Method:</strong>{" "}
                  {scanResult.ticket.paymentMethod.toUpperCase()}
                </p>
                <p>
                  <strong>Code:</strong> {scanResult.ticket.qrCode}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            {scanResult?.status === "valid" && (
              <Button onClick={handleAdmit} className="bg-green-600 hover:bg-green-700">
                <UserCheck className="h-4 w-4 mr-2" />
                Mark as Admitted
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
