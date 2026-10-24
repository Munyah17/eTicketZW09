"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Ticket, LogIn, Eye, EyeOff, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [notice, setNotice] = useState("");

  // Banners for links that land here: confirmed emails (?confirmed=1) and
  // failed/expired link errors (?error=...) redirected by /auth/callback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed")) setNotice("Email confirmed — sign in below.");
    else if (params.get("error")) setNotice(params.get("error") || "");
  }, []);

  // This page is for customers and organizers only — Admin and Super Admin
  // have their own dedicated sign-in surfaces. A privileged SESSION landing
  // here is sent to its own portal rather than signed out — force-logging
  // them out turned every stray redirect to /login into a real sign-out.
  useEffect(() => {
    if (!loading && user) {
      const role = user.role;
      if (role === "super_admin") { router.push("/super-admin"); return; }
      if (role === "admin") { router.push("/admin"); return; }
      if (role === "organizer") router.push("/creator");
      else if (role === "staff") router.push("/validate");
      else router.push("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter email and password."); return; }
    setError("");
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      // redirect handled by useEffect above
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (/email not confirmed/i.test(msg)) {
        setNeedsConfirm(true);
        setError("Please confirm your email address before signing in.");
      } else {
        setError(msg.includes("Invalid login credentials") ? "Incorrect email or password." : msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Self-serve recovery when the confirmation email never arrived — spam,
  // a filter, or a silent drop. GoTrue's resend endpoint re-fires the
  // branded confirmation mail for unconfirmed accounts.
  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResendMsg(error ? `Couldn't resend: ${error.message}` : "Confirmation email resent — check inbox and spam.");
    setResending(false);
  };

  // Forgot-password — sends the branded recovery email; the link lands on
  // /reset-password where the user sets a new password.
  const handleForgot = async () => {
    if (!email.includes("@")) { setForgotMsg("Enter your account email above first."); return; }
    setForgotSending(true);
    setForgotMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setForgotMsg(error ? `Couldn't send: ${error.message}` : "Reset link sent — check inbox and spam.");
    setForgotSending(false);
  };

  if (loading) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Ticket className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your E-TicketsZW account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            {notice && (
              <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
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

              {needsConfirm && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 space-y-2">
                  <p>Didn&apos;t get the email? It may be in Spam or Promotions — or we can send it again.</p>
                  <Button
                    type="button" variant="outline" size="sm" className="w-full"
                    onClick={handleResend} disabled={resending}
                  >
                    <MailCheck className="mr-2 h-4 w-4" />
                    {resending ? "Resending…" : "Resend confirmation email"}
                  </Button>
                  {resendMsg && <p className="text-xs">{resendMsg}</p>}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : (
                  <><LogIn className="mr-2 h-4 w-4" />Sign In</>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setForgotOpen((v) => !v); setForgotMsg(""); }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
                >
                  Forgot password?
                </button>
                {forgotOpen && (
                  <div className="mt-3 rounded-md border px-3 py-3 text-left space-y-2">
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send a reset link to the email entered above.
                    </p>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleForgot} disabled={forgotSending}>
                      {forgotSending ? "Sending…" : "Send reset link"}
                    </Button>
                    {forgotMsg && <p className="text-xs text-muted-foreground">{forgotMsg}</p>}
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
