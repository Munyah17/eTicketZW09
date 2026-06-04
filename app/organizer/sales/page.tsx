"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Calendar,
  ArrowRight,
  Download,
} from "lucide-react";
import { mockTickets, mockEvents } from "@/lib/mock-data";

export default function OrganizerSalesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const organizerEvents = mockEvents.slice(0, 3);
  const eventIds = organizerEvents.map((e) => e.id);
  const sales = mockTickets.filter((t) => eventIds.includes(t.eventId));

  const filteredSales = sales.filter(
    (sale) =>
      sale.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = sales.reduce((sum, t) => sum + t.totalPaid, 0);
  const totalTickets = sales.length;
  const onlineSales = sales.filter((s) => s.saleType === "online").length;
  const gateSales = sales.filter((s) => s.saleType === "gate").length;

  const stats = [
    {
      title: "Total Sales",
      value: totalTickets,
      icon: Ticket,
    },
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: "Online Sales",
      value: onlineSales,
      icon: TrendingUp,
    },
    {
      title: "Gate Sales",
      value: gateSales,
      icon: Users,
    },
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
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by buyer, event, or ticket ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{sale.id}</TableCell>
                      <TableCell className="font-medium">{sale.eventTitle}</TableCell>
                      <TableCell>
                        <div>
                          <p>{sale.buyerDisplayName}</p>
                          <p className="text-xs text-muted-foreground">{sale.buyerContact}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sale.ticketTypeName}</TableCell>
                      <TableCell>
                        <span className="font-medium">${sale.totalPaid.toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {sale.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sale.paymentStatus === "completed" ? "default" : "secondary"}
                          className={
                            sale.paymentStatus === "completed"
                              ? "bg-success text-success-foreground"
                              : ""
                          }
                        >
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(sale.purchasedAt).toLocaleDateString("en-ZW", {
                          day: "numeric",
                          month: "short",
                        })}
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
