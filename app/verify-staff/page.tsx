"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckResult {
  status: "valid" | "revoked" | "invalid";
  message: string;
  pass?: {
    fullName: string;
    photoUrl: string;
    companyName: string;
    position: string;
    eventTitle: string;
    eventDate?: string;
  };
}

function VerifyStaffContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    if (!code) {
      setResult({ status: "invalid", message: "No credential code provided." });
      return;
    }
    fetch(`/api/service-providers/check?code=${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then(setResult)
      .catch(() => setResult({ status: "invalid", message: "Could not check this credential. Please try again." }));
  }, [code]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-secondary/30">
        <div className="w-full max-w-md px-4 py-10">
          <Card>
            <CardHeader className="text-center">
              <div
                className={cn(
                  "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                  !result ? "bg-muted" : result.status === "valid" ? "bg-success/10" : result.status === "revoked" ? "bg-warning/10" : "bg-destructive/10"
                )}
              >
                {!result ? (
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : result.status === "valid" ? (
                  <CheckCircle2 className="h-8 w-8 text-success" />
                ) : result.status === "revoked" ? (
                  <AlertTriangle className="h-8 w-8 text-warning" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive" />
                )}
              </div>
              <CardTitle className="mt-3">
                {!result
                  ? "Checking credential…"
                  : result.status === "valid"
                  ? "Genuine Service Provider Credential"
                  : result.status === "revoked"
                  ? "Credential Revoked"
                  : "Invalid Credential"}
              </CardTitle>
              {result && <CardDescription>{result.message}</CardDescription>}
            </CardHeader>
            {result?.pass && (
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {result.pass.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.pass.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{result.pass.fullName}</p>
                    <p className="text-sm text-muted-foreground">{result.pass.position} · {result.pass.companyName}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm border-t pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Providing service to</span>
                    <span className="font-medium text-right">{result.pass.eventTitle}</span>
                  </div>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  This is a read-only authenticity check by E-TicketsZW.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function VerifyStaffPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <VerifyStaffContent />
    </Suspense>
  );
}
