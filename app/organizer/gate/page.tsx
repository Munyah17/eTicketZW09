"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
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
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrganizerEvents } from "@/lib/events-store";
import { Ticket as TicketType, Event } from "@/lib/types";

type ScanResult = {
  status: "valid" | "invalid" | "admitted" | "not_found";
  ticket?: Record<string, unknown>;
  message: string;
};

function mapTicket(r: Record<string, unknown>): TicketType {
  return {
    id: r.id as string,
    eventId: r.event_id as string,
    ticketTypeId: r.ticket_type_id as string,
    ticketTypeName: r.ticket_type_name as string,
    eventTitle: r.event_title as string,
    eventDate: r.event_date as string,
    eventTime: r.event_time as string,
    venue: r.venue as string,
    buyerName: r.buyer_name as string,
    buyerContact: r.buyer_contact as string,
    buyerDisplayName: r.buyer_display_name as string,
    price: Number(r.price),
    markup: Number(r.markup),
    totalPaid: Number(r.total_paid),
    currency: "USD",
    paymentMethod: r.payment_method as TicketType["paymentMethod"],
    paymentStatus: r.payment_status as TicketType["paymentStatus"],
    qrCode: r.qr_code as string,
    validated: Boolean(r.validated),
    validatedAt: r.validated_at as string | undefined,
    validatedBy: r.validated_by as string | undefined,
    admittedAt: r.admitted_at as string | undefined,
    admittedBy: r.admitted_by as string | undefined,
    isAdmitted: Boolean(r.is_admitted),
    purchasedAt: r.purchased_at as string,
    saleType: r.sale_type as TicketType["saleType"],
  };
}

export default function GateManagementPage() {
  const { user } = useAuth();
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const scannerRef = useRef<{ stop: () => void } | null>(null);
  const manualCodeRef = useRef<HTMLInputElement>(null);

  // Keep focus in the manual-code field between scans so an external
  // USB/Bluetooth barcode scanner (keyboard-wedge input) can fire repeatedly
  // without staff needing to click back into the field each time.
  useEffect(() => {
    if (!isScanning && !dialogOpen) manualCodeRef.current?.focus();
  }, [isScanning, dialogOpen]);

  useEffect(() => {
    if (user) getOrganizerEvents(user.id).then((events) => setOrganizerEvents(events.filter((e) => e.status === "published")));
  }, [user]);

  const loadTickets = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizer/gate?eventId=${selectedEvent}`);
      const json = await res.json();
      setTickets(((json.tickets ?? []) as Record<string, unknown>[]).map(mapTicket));
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const admittedCount = tickets.filter((t) => t.isAdmitted).length;
  const validCount = tickets.filter((t) => t.paymentStatus === "completed" && !t.isAdmitted).length;

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("qr-reader");

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
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
      if (scannerRef.current) scannerRef.current.stop();
    };
  }, []);

  const handleScan = async (code: string) => {
    const res = await fetch("/api/organizer/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan", eventId: selectedEvent, code }),
    });
    const result = await res.json();
    setScanResult(result);
    setDialogOpen(true);
  };

  const handleManualSearch = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode("");
    }
  };

  const handleAdmit = async () => {
    if (!scanResult?.ticket) return;
    const res = await fetch("/api/organizer/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "admit", ticketId: scanResult.ticket.id }),
    });
    const result = await res.json();
    setScanResult(result);
    loadTickets();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gate Management</h1>
        <p className="text-muted-foreground mt-1">
          Validate and admit ticket holders at the gate
        </p>
      </div>

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
              {organizerEvents.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No published events</div>
              )}
              {organizerEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title} - {new Date(event.date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedEvent && loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedEvent && !loading && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Total Tickets" value={tickets.length} icon={Ticket} iconClassName="bg-primary/10 text-primary" />
            <StatCard label="Admitted" value={admittedCount} icon={UserCheck} iconClassName="bg-green-100 text-green-700" />
            <StatCard label="Pending Entry" value={validCount} icon={Ticket} iconClassName="bg-amber-100 text-amber-700" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  QR Code Scanner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div id="qr-reader" className="w-full aspect-square bg-muted rounded-lg overflow-hidden">
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
                    <Button onClick={stopScanner} variant="destructive" className="flex-1">
                      Stop Scanner
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

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
                      ref={manualCodeRef}
                      autoFocus
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Ready to scan — external scanner or type manually"
                      onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                    />
                    <Button onClick={handleManualSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Admissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tickets
                  .filter((t) => t.isAdmitted)
                  .slice(0, 10)
                  .map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
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
                          {ticket.admittedAt && new Date(ticket.admittedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                {tickets.filter((t) => t.isAdmitted).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No admissions yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResult?.status === "valid" && (<><CheckCircle className="h-6 w-6 text-green-600" />Valid Ticket</>)}
              {scanResult?.status === "admitted" && (<><AlertTriangle className="h-6 w-6 text-amber-600" />Already Admitted</>)}
              {scanResult?.status === "invalid" && (<><XCircle className="h-6 w-6 text-red-600" />Invalid Ticket</>)}
              {scanResult?.status === "not_found" && (<><Ban className="h-6 w-6 text-red-600" />Not Found</>)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className={`text-lg font-medium ${scanResult?.status === "valid" ? "text-green-600" : scanResult?.status === "admitted" ? "text-amber-600" : "text-red-600"}`}>
              {scanResult?.message}
            </p>

            {scanResult?.ticket && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p>
                  <strong>Name:</strong> {scanResult.ticket.buyer_display_name as string}
                  {scanResult.ticket.buyer_display_name !== scanResult.ticket.buyer_name && (
                    <span className="text-muted-foreground"> ({scanResult.ticket.buyer_name as string})</span>
                  )}
                </p>
                <p><strong>Contact:</strong> {scanResult.ticket.buyer_contact as string}</p>
                <p><strong>ID Number:</strong> {(scanResult.ticket.id_number as string) || "Not provided"}</p>
                <p><strong>Ticket Type:</strong> {scanResult.ticket.ticket_type_name as string}</p>
                <p><strong>Amount Paid:</strong> ${scanResult.ticket.total_paid as number} {scanResult.ticket.currency as string}</p>
                <p><strong>Payment Method:</strong> {(scanResult.ticket.payment_method as string)?.toUpperCase()}</p>
                <p><strong>Code:</strong> {scanResult.ticket.qr_code as string}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
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
