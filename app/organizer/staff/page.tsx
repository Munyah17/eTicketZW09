"use client";

import { useState } from "react";
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
import { UserPlus, Shield, Ticket, Trash2, Edit2 } from "lucide-react";
import { mockStaffMembers, mockEvents } from "@/lib/mock-data";
import { StaffMember } from "@/lib/types";

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>(mockStaffMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "gate_manager" as "gate_manager" | "ticket_seller",
    assignedEvents: [] as string[],
  });

  const organizerEvents = mockEvents.filter(
    (e) => e.organizerId === "org-001"
  );

  const handleSubmit = () => {
    if (editingStaff) {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editingStaff.id
            ? { ...s, ...formData }
            : s
        )
      );
    } else {
      const newStaff: StaffMember = {
        id: `staff-${Date.now()}`,
        organizerId: "org-001",
        ...formData,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setStaff((prev) => [...prev, newStaff]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "gate_manager",
      assignedEvents: [],
    });
    setEditingStaff(null);
    setDialogOpen(false);
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

  const handleDelete = (id: string) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleActive = (id: string) => {
    setStaff((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isActive: !s.isActive } : s
      )
    );
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
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Staff Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(member)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleActive(member.id)}
                >
                  {member.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(member.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Staff Table */}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="email@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
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
                            assignedEvents: prev.assignedEvents.filter(
                              (id) => id !== event.id
                            ),
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
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingStaff ? "Save Changes" : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
