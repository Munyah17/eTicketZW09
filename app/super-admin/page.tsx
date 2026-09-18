"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Crown, LogIn, Eye, EyeOff, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "credentials" | "enroll" | "verify";

// Super Admin sign-in — the ONLY entry point to the /private portal.
// Two factors, both enforced server-side (see proxy.ts): password first,
// then a TOTP code from an authenticator app (Google Authenticator, Authy,
// 1Password…). First login enrolls a new factor — the QR/secret shown here
// is the only time it is displayed. A session that hasn't completed TOTP
// stays at aal1 and is bounced back here by the proxy, so there is no path
// into the portal without the second factor.
export default function SuperAdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [enrollQr, setEnrollQr] = useState("");
  const [enrollSecret, setEnrollSecret] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const genericError = "Incorrect credentials.";

  // Decide what an authenticated (aal1+) session still needs: nothing if
  // already aal2, a code if a factor is enrolled, enrollment otherwise.
  const advanceFromSession = useCallback(async (): Promise<boolean> => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") {
      router.push("/private");
      return true;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setStep("verify");
      return true;
    }

    // No verified factor — clear stale unverified enrollments, then enroll.
    for (const f of factors?.totp ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Super Admin Authenticator",
    });
    if (enrollError || !enroll) {
      setError(
        "Authenticator setup failed. Confirm TOTP MFA is enabled for this Supabase project (Authentication → Multi-Factor), then try again."
      );
      return true;
    }
    setFactorId(enroll.id);
    setEnrollQr(enroll.totp.qr_code);
    setEnrollSecret(enroll.totp.secret);
    setStep("enroll");
    return true;
  }, [supabase, router]);

  // Landing here with a live session (e.g. bounced back by the proxy at
  // aal1): skip the password form and go straight to the MFA step.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role === "super_admin") await advanceFromSession();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) { setError("Please enter your username/email and password."); return; }
    setError("");
    setIsSubmitting(true);
    try {
      // Username or email — resolve usernames server-side (super_admin only).
      let email = identifier.trim();
      if (!email.includes("@")) {
        const res = await fetch("/api/super-admin/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email }),
        });
        if (!res.ok) throw new Error(genericError);
        email = (await res.json()).email;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) throw new Error(genericError);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_suspended")
        .eq("id", data.user.id)
        .single();

      if (profile?.role !== "super_admin" || profile.is_suspended) {
        await supabase.auth.signOut();
        throw new Error(genericError);
      }

      await advanceFromSession();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setError("");
    setIsSubmitting(true);
    try {
      // Enrollment produces an unverified factor — verify() both confirms the
      // code and marks the factor verified, so challenge+verify covers both
      // the enroll and the returning-user paths.
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw new Error("Could not start verification. Try again.");

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw new Error("Incorrect code. Check your authenticator app and try again.");

      router.push("/private");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Crown className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
        </div>

        <Card>
          {step === "credentials" && (
            <>
              <CardHeader>
                <CardTitle className="text-lg">Sign In</CardTitle>
                <CardDescription>Enter your username or email and password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="identifier">Username or Email</Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="Username or you@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={isSubmitting}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in…" : (
                      <><LogIn className="mr-2 h-4 w-4" />Continue</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {step === "enroll" && (
            <>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />Set Up Two-Factor Auth
                </CardTitle>
                <CardDescription>
                  Scan this code with Google Authenticator (or any TOTP app), then enter the 6-digit code it shows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="space-y-4">
                  {enrollQr && (
                    <div className="flex justify-center rounded-md bg-white p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={enrollQr} alt="Authenticator QR code" className="h-48 w-48" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Manual entry key</Label>
                    <code className="block break-all rounded-md bg-muted px-3 py-2 text-sm">
                      {enrollSecret}
                    </code>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="enroll-code">6-digit code</Label>
                    <Input
                      id="enroll-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      disabled={isSubmitting}
                    />
                  </div>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Verifying…" : (
                      <><ShieldCheck className="mr-2 h-4 w-4" />Verify & Sign In</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {step === "verify" && (
            <>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />Two-Factor Auth
                </CardTitle>
                <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="verify-code">6-digit code</Label>
                    <Input
                      id="verify-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      disabled={isSubmitting}
                    />
                  </div>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Verifying…" : (
                      <><ShieldCheck className="mr-2 h-4 w-4" />Verify & Sign In</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
