"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings,
  Save,
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  CreditCard,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ORGANIZER_CATEGORIES, OrganizerCategory } from "@/lib/types";

export default function OrganizerSettingsPage() {
  const { user, loading, updateProfile } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState<string>("");
  const [subtype, setSubtype] = useState("");
  const [organizerRowId, setOrganizerRowId] = useState<string | null>(null);

  const [profileMsg, setProfileMsg] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) { if (!loading) setLoadingData(false); return; }
    setName(user.name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setCategory(user.organizerCategory || "");
    setSubtype(user.organizerSubtype || "");

    const supabase = createClient();
    supabase
      .from("organizers")
      .select("id, company, organizer_category, organizer_subtype")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOrganizerRowId(data.id as string);
          setCompany((data.company as string) || "");
          setCategory((data.organizer_category as string) || user.organizerCategory || "");
          setSubtype((data.organizer_subtype as string) || user.organizerSubtype || "");
        }
        setLoadingData(false);
      });
  }, [user, loading]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        organizerCategory: (category || undefined) as OrganizerCategory | undefined,
        organizerSubtype: subtype || undefined,
      });
      if (organizerRowId) {
        const supabase = createClient();
        const { error } = await supabase
          .from("organizers")
          .update({
            name: name.trim(),
            phone: phone.trim(),
            company: company.trim() || null,
            organizer_category: category || null,
            organizer_subtype: subtype.trim() || null,
          })
          .eq("id", organizerRowId);
        if (error) throw new Error(error.message);
      }
      setProfileMsg("Settings saved.");
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMsg("");
    setPasswordError("");
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match."); return; }
    setSavingPassword(true);
    const supabase = createClient();
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword,
      });
      if (verifyError) {
        setPasswordError("Current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
        return;
      }
      setPasswordMsg("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your organizer profile and account security
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your public organizer profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Organizer Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="pl-10"
                  placeholder="Registered or trading name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  className="pl-10"
                  disabled
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  placeholder="+263771234567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Organizer Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZER_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtype">Subtype (optional)</Label>
              <Input
                id="subtype"
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                placeholder="e.g. Comedy, Live Music"
              />
            </div>
          </div>
          {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={handleSaveProfile} disabled={savingProfile}>
            <Save className="h-4 w-4" />
            {savingProfile ? "Saving…" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Payout details live on the Payouts page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payout Details
          </CardTitle>
          <CardDescription>
            Where we send your earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Payout methods (bank accounts, EcoCash) are managed on the{" "}
            <Link href="/creator/payouts" className="text-primary underline underline-offset-2">
              Payouts page
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security
          </CardTitle>
          <CardDescription>
            Change your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgCurrentPassword">Current Password</Label>
            <Input id="orgCurrentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orgNewPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="orgNewPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgConfirmPassword">Confirm New Password</Label>
              <Input id="orgConfirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          {passwordError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{passwordError}</p>}
          {passwordMsg && <p className="text-sm text-success">{passwordMsg}</p>}
          <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
            {savingPassword ? "Updating…" : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
