"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Ticket,
  DollarSign,
  TrendingUp,
  Users,
  RefreshCw,
  Download,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/export-menu";
import { DateRangeFilter, inDateRange } from "@/components/ui/date-range-filter";
import type { ExportColumn } from "@/lib/export-utils";

interface SaleRow {
  id: string;
  eventTitle: string;
  buyerDisplayName: string;
  buyerContact: string;
  ticketTypeName: string;
  totalPaid: number;
  paymentMethod: string;
  paymentStatus: string;
  purchasedAt: string;
  saleType: "online" | "gate";
}

function mapSale(r: Record<string, unknown>): SaleRow {
  return {
    id: r.id as string,
    eventTitle: r.event_title as string,
    buyerDisplayName: (r.buyer_display_name as string) || (r.buyer_name as string),
    buyerContact: r.buyer_contact as string,
    ticketTypeName: r.ticket_type_name as string,
    totalPaid: Number(r.total_paid),
    paymentMethod: r.payment_method as string,
    paymentStatus: r.payment_status as string,
    purchasedAt: r.purchased_at as string,
    saleType: r.sale_type as "online" | "gate",
  };
}

export default function OrganizerSalesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetch("/api/organizer/sales")
      .then((res) => res.json())
      .then((data) => {
        setSales(((data.tickets ?? []) as Record<string, unknown>[]).map(mapSale));
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredSales = sales.filter(
    (sale) =>
      (sale.buyerDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
      inDateRange(sale.purchasedAt, dateFrom, dateTo)
  );

  const totalRevenue = sales.reduce((sum, t) => sum + t.totalPaid, 0);
  const totalTickets = sales.length;
  const onlineSales = sales.filter((s) => s.saleType === "online").length;
  const gateSales = sales.filter((s) => s.saleType === "gate").length;

  const stats = [
    { title: "Total Sales", value: totalTickets, icon: Ticket },
    { title: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign },
    { title: "Online Sales", value: onlineSales, icon: TrendingUp },
    { title: "Gate Sales", value: gateSales, icon: Users },
  ];

  const exportColumns: ExportColumn<SaleRow>[] = [
    { header: "Ticket ID", accessor: (s) => s.id },
    { header: "Event", accessor: (s) => s.eventTitle },
    { header: "Buyer", accessor: (s) => s.buyerDisplayName },
    { header: "Type", accessor: (s) => s.ticketTypeName },
    { header: "Amount", accessor: (s) => s.totalPaid.toFixed(2) },
    { header: "Method", accessor: (s) => s.paymentMethod },
    { header: "Status", accessor: (s) => s.paymentStatus },
    { header: "Date", accessor: (s) => s.purchasedAt },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ticket Sales</h1>
          <p className="text-muted-foreground">
            Track all ticket sales across your events
          </p>
        </div>
        <ExportMenu rows={filteredSales} columns={exportColumns} filename="sales" title="Ticket Sales" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} label={stat.title} value={stat.value} icon={stat.icon} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by buyer, event, or ticket ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Ticket ID</TableHead>
                  <TableHead className="whitespace-nowrap">Event</TableHead>
                  <TableHead className="whitespace-nowrap">Buyer</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Amount</TableHead>
                  <TableHead className="whitespace-nowrap">Method</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{sale.id.slice(0, 8)}…</TableCell>
                      <TableCell className="font-medium">{sale.eventTitle}</TableCell>
                      <TableCell>
                        <div>
                          <p>{sale.buyerDisplayName}</p>
                          <p className="text-xs text-muted-foreground">{sale.buyerContact}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sale.ticketTypeName}</TableCell>
                      <TableCell>
                        <span className="font-mono font-medium">${sale.totalPaid.toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {sale.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sale.paymentStatus === "completed" ? "default" : "secondary"}
                          className={sale.paymentStatus === "completed" ? "bg-success text-success-foreground" : ""}
                        >
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(sale.purchasedAt).toLocaleDateString("en-ZW", { day: "numeric", month: "short" })}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`/api/tickets/${sale.id}/download`}
                          download={`ticket-${sale.id}.png`}
                          className="inline-block"
                          title="Download ticket PNG"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
