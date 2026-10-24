"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Shield, User, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { user, loading, updateProfile } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      setProfileMsg("Profile updated.");
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "Could not save profile.");
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
      // Re-verify the current password before allowing the change — an
      // unattended unlocked session shouldn't be able to rotate it alone.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user!.email,
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

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-md p-6">
            <h1 className="text-2xl font-bold">Sign in required</h1>
            <p className="mt-2 text-muted-foreground">Sign in to manage your account settings.</p>
            <Link href="/login" className="mt-6 inline-block">
              <Button>Sign In</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">
              Manage your profile and security
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Profile
                </CardTitle>
                <CardDescription>Your name and contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Full Name</Label>
                  <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email">Email Address</Label>
                  <Input id="settings-email" value={user?.email ?? ""} disabled />
                  <p className="text-xs text-muted-foreground">
                    Email changes are handled by support — contact us to change it.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-phone">Phone Number</Label>
                  <Input id="settings-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263771234567" />
                </div>
                {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
                <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={handleSaveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4" />
                  {savingProfile ? "Saving…" : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security
                </CardTitle>
                <CardDescription>Change your password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
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
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <Input id="confirmNewPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                </div>
                {passwordError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{passwordError}</p>}
                {passwordMsg && <p className="text-sm text-success">{passwordMsg}</p>}
                <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword}>
                  {savingPassword ? "Updating…" : "Update Password"}
                </Button>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              Ticket and event updates are delivered by email and WhatsApp automatically.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
