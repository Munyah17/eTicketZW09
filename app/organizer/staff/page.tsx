"use client";

import { useState, useEffect, useCallback } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, Ticket, Trash2, Edit2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrganizerEvents } from "@/lib/events-store";
import { StaffMember, Event } from "@/lib/types";

function mapStaff(r: Record<string, unknown>): StaffMember {
  return {
    id: r.id as string,
    organizerId: r.organizer_id as string,
    name: r.name as string,
    email: r.email as string,
    phone: r.phone as string,
    role: r.role as StaffMember["role"],
    assignedEvents: (r.assigned_events as string[]) ?? [],
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
  };
}

export default function StaffManagementPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "gate_manager" as "gate_manager" | "ticket_seller",
    assignedEvents: [] as string[],
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizer/staff");
      const json = await res.json();
      setStaff(((json.staff ?? []) as Record<string, unknown>[]).map(mapStaff));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    if (user) getOrganizerEvents(user.id).then(setOrganizerEvents);
  }, [reload, user]);

  const handleSubmit = async () => {
    setFormError("");
    if (!formData.name || !formData.email) {
      setFormError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = editingStaff
        ? await fetch("/api/organizer/staff", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffId: editingStaff.id, ...formData, assignedEvents: formData.assignedEvents }),
          })
        : await fetch("/api/organizer/staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
      const json = await res.json();
      if (!res.ok) { setFormError(json.error ?? "Failed to save staff member"); return; }
      resetForm();
      reload();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", role: "gate_manager", assignedEvents: [] });
    setEditingStaff(null);
    setDialogOpen(false);
    setFormError("");
  };

  const handleEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      assignedEvents: member.assignedEvents,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/organizer/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: id }),
    });
    reload();
  };

  const handleToggleActive = async (member: StaffMember) => {
    await fetch("/api/organizer/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: member.id, isActive: !member.isActive }),
    });
    reload();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage gate managers and ticket sellers for your events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staff.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No staff members yet. Add your first gate manager or ticket seller.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <Card key={member.id} className={!member.isActive ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        member.role === "gate_manager"
                          ? "bg-primary/10"
                          : "bg-amber-100"
                      }`}
                    >
                      {member.role === "gate_manager" ? (
                        <Shield className="h-5 w-5 text-primary" />
                      ) : (
                        <Ticket className="h-5 w-5 text-amber-700" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {member.role.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={member.isActive ? "default" : "secondary"}>
                    {member.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <p className="text-muted-foreground">{member.email}</p>
                  <p className="text-muted-foreground">{member.phone}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Assigned Events:</p>
                  <div className="flex flex-wrap gap-1">
                    {member.assignedEvents.map((eventId) => {
                      const event = organizerEvents.find((e) => e.id === eventId);
                      return event ? (
                        <Badge key={eventId} variant="outline" className="text-xs">
                          {event.title.slice(0, 20)}...
                        </Badge>
                      ) : null;
                    })}
                    {member.assignedEvents.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No events assigned
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(member)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleToggleActive(member)}>
                    {member.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(member.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Staff Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Assigned Events</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="capitalize">
                    {member.role.replace("_", " ")}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.assignedEvents.length} events</TableCell>
                  <TableCell>
                    <Badge variant={member.isActive ? "default" : "secondary"}>
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{formError}</p>}
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+263..."
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: "gate_manager" | "ticket_seller") =>
                  setFormData((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gate_manager">
                    Gate Manager (Entry Management)
                  </SelectItem>
                  <SelectItem value="ticket_seller">
                    Ticket Seller (Gate Sales)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assign to Events</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {organizerEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground">You have no events yet.</p>
                )}
                {organizerEvents.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={formData.assignedEvents.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((prev) => ({
                            ...prev,
                            assignedEvents: [...prev.assignedEvents, event.id],
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            assignedEvents: prev.assignedEvents.filter((id) => id !== event.id),
                          }));
                        }
                      }}
                    />
                    <span className="text-sm">{event.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : editingStaff ? "Save Changes" : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
