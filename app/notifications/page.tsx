"use client";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Ticket,
  DollarSign,
  Calendar,
  CheckCircle2,
  Trash2,
} from "lucide-react";

const notifications = [
  {
    id: "notif-1",
    type: "ticket",
    title: "Ticket Purchase Confirmed",
    message: "Your ticket for Ghettocracy Comedy Night has been confirmed.",
    time: "2 hours ago",
    read: false,
    icon: Ticket,
  },
  {
    id: "notif-2",
    type: "event",
    title: "Event Reminder",
    message: "Harare Marathon 2024 is happening tomorrow at 06:00 AM.",
    time: "5 hours ago",
    read: false,
    icon: Calendar,
  },
  {
    id: "notif-3",
    type: "payment",
    title: "Payout Approved",
    message: "Your payout request of $750 has been approved and processed.",
    time: "1 day ago",
    read: true,
    icon: DollarSign,
  },
  {
    id: "notif-4",
    type: "ticket",
    title: "Ticket Sold",
    message: "5 VIP tickets for Jah Prayzah Live were sold in the last hour.",
    time: "2 days ago",
    read: true,
    icon: Ticket,
  },
  {
    id: "notif-5",
    type: "event",
    title: "New Event Listed",
    message: "A new comedy show has been listed in your city - check it out!",
    time: "3 days ago",
    read: true,
    icon: Calendar,
  },
];

export default function NotificationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-muted-foreground">
                Stay updated with your events and tickets
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Mark all read
            </Button>
          </div>

          <div className="mt-8 space-y-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={notification.read ? "opacity-70" : ""}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      notification.read ? "bg-secondary" : "bg-primary/10"
                    }`}
                  >
                    <notification.icon
                      className={`h-5 w-5 ${
                        notification.read ? "text-muted-foreground" : "text-primary"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{notification.title}</h3>
                      {!notification.read && (
                        <Badge variant="default" className="h-2 w-2 rounded-full p-0 bg-primary" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {notification.time}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
