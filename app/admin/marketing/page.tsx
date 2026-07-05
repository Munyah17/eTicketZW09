"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Megaphone, Mail, MessageSquare, Search, Users, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "all" | "customers" | "organizers" | "custom";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "organizer";
}

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "customers", label: "Customers Only" },
  { value: "organizers", label: "Organizers Only" },
  { value: "custom", label: "Custom Selection" },
];

export default function MarketingPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState<Audience>("all");
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [customSearch, setCustomSearch] = useState("");
  const [emailOn, setEmailOn] = useState(true);
  const [smsOn, setSmsOn] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ totalRecipients: number; emailSent: number; smsNote?: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/marketing/audience")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts ?? []))
      .finally(() => setLoading(false));
  }, []);

  const recipientCount = useMemo(() => {
    if (audience === "all") return contacts.length;
    if (audience === "customers") return contacts.filter((c) => c.role === "customer").length;
    if (audience === "organizers") return contacts.filter((c) => c.role === "organizer").length;
    return customIds.size;
  }, [audience, contacts, customIds]);

  const filteredContacts = useMemo(() => {
    if (!customSearch.trim()) return contacts;
    const q = customSearch.trim().toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [contacts, customSearch]);

  const toggleCustom = useCallback((id: string) => {
    setCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canSend = subject.trim() && message.trim() && (emailOn || smsOn) && recipientCount > 0;

  const handleSend = async () => {
    setSending(true);
    setConfirmOpen(false);
    try {
      const res = await fetch("/api/admin/marketing/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          customIds: audience === "custom" ? Array.from(customIds) : undefined,
          channels: { email: emailOn, sms: smsOn },
          subject,
          message,
        }),
      });
      const json = await res.json();
      if (res.ok) setResult(json);
      else setResult({ totalRecipients: 0, emailSent: 0, smsNote: json.error });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="h-7 w-7 text-primary" />
          Marketing
        </h1>
        <p className="text-muted-foreground mt-1">
          Send announcements and updates to organizers and customers by email or SMS.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Audience</CardTitle>
          <CardDescription>Choose who receives this message.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={audience === opt.value ? "default" : "outline"}
                size="sm"
                className={audience === opt.value ? "bg-primary hover:bg-primary/90" : ""}
                onClick={() => setAudience(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {loading ? "Loading contacts…" : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"} selected`}
          </div>

          {audience === "custom" && (
            <div className="rounded-lg border">
              <div className="relative border-b p-2">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customSearch}
                  onChange={(e) => setCustomSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {filteredContacts.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No contacts found</p>
                )}
                {filteredContacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <Checkbox checked={customIds.has(c.id)} onCheckedChange={() => toggleCustom(c.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0">{c.role}</Badge>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Channels</CardTitle>
          <CardDescription>Pick how this message goes out.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer">
            <Checkbox checked={emailOn} onCheckedChange={(v) => setEmailOn(v as boolean)} />
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Email</span>
          </label>
          <label className={cn("flex items-center gap-2 rounded-lg border px-4 py-3", "cursor-pointer")}>
            <Checkbox checked={smsOn} onCheckedChange={(v) => setSmsOn(v as boolean)} />
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">SMS</span>
            <Badge variant="outline" className="ml-1 text-xs">Not configured yet</Badge>
          </label>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5" placeholder="e.g. New events just added for August" />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5 min-h-[160px]"
              placeholder="Write your announcement…"
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={!canSend || sending} onClick={() => setConfirmOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              Send to {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">
                {result.emailSent > 0 ? `Sent to ${result.emailSent} email recipient${result.emailSent === 1 ? "" : "s"}.` : "No emails were sent."}
              </p>
              {result.smsNote && <p className="mt-1 text-muted-foreground">{result.smsNote}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this announcement?</DialogTitle>
            <DialogDescription>
              This will message {recipientCount} recipient{recipientCount === 1 ? "" : "s"} via{" "}
              {[emailOn && "Email", smsOn && "SMS"].filter(Boolean).join(" and ")}. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} className="bg-primary hover:bg-primary/90">Send Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
