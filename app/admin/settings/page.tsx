"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Save, KeyRound, CheckCircle2, Crown, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

// This is the logged-in admin/super-admin's own account settings — not
// site-wide configuration (that's Platform Config). Two very different
// pages that used to accidentally overlap (this one had a second, fake
// "Maintenance Mode" toggle that did nothing).
export default function MyAccountPage() {
  const { user, isSuperAdmin } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from("profiles").select("username").eq("id", user.id).single().then(({ data }) => {
      if (data?.username) setUsername(data.username);
    });
  }, [user]);

  if (!user) return null;

  const handleSaveProfile = async () => {
    setProfileError("");
    setSavingProfile(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ name, phone, username: username || null })
        .eq("id", user.id);
      if (error) { setProfileError(error.message); return; }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPasswordError(error.message); return; }
      setPasswordSaved(true);
      setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="text-muted-foreground">
          Your own profile and login — for site-wide settings, see Platform Configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>Your name, phone, and username as shown across the admin panel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 pb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
              {name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{user.email}</p>
                {isSuperAdmin ? (
                  <Badge className="gap-1 bg-yellow-100 text-yellow-800 border-0"><Crown className="h-3 w-3" /> Super Admin</Badge>
                ) : (
                  <Badge className="gap-1 bg-blue-100 text-blue-800 border-0"><Shield className="h-3 w-3" /> Admin</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 7X XXX XXXX" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Munyah" />
            </div>
          </div>

          {profileError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{profileError}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2 bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4" /> {savingProfile ? "Saving…" : "Save Profile"}
            </Button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Update the password for this account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>

          {passwordError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{passwordError}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} className="gap-2 bg-primary hover:bg-primary/90">
              <KeyRound className="h-4 w-4" /> {changingPassword ? "Updating…" : "Change Password"}
            </Button>
            {passwordSaved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Password updated
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
