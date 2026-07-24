"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Wallet, Percent, CreditCard, ArrowRightLeft, RefreshCw } from "lucide-react";

interface WalletData {
  totalBuyerFees: number;
  totalCommissions: number;
  totalEarnings: number;
  totalMoneyProcessed: number;
  ticketsCounted: number;
  trend: { date: string; buyerFees: number; commissions: number; total: number }[];
}

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SystemWalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wallet");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load wallet data.");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxTrendValue = data ? Math.max(1, ...data.trend.map((t) => t.total)) : 1;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            System Wallet
          </h1>
          <p className="text-muted-foreground mt-1">
            What the platform actually earns — kept separate from total money processed on buyers&apos; behalf.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Platform Earnings"
          value={loading ? "—" : money(data?.totalEarnings ?? 0)}
          icon={Wallet}
          iconClassName="bg-emerald-50 text-emerald-600"
          sub="Buyer fees + organizer commissions"
        />
        <StatCard
          label="Buyer Service Fees"
          value={loading ? "—" : money(data?.totalBuyerFees ?? 0)}
          icon={CreditCard}
          iconClassName="bg-blue-50 text-blue-600"
          sub="Charged on top of ticket price"
        />
        <StatCard
          label="Organizer Commissions"
          value={loading ? "—" : money(data?.totalCommissions ?? 0)}
          icon={Percent}
          iconClassName="bg-violet-50 text-violet-600"
          sub="Taken from organizer proceeds"
        />
        <StatCard
          label="Total Money Processed"
          value={loading ? "—" : money(data?.totalMoneyProcessed ?? 0)}
          icon={ArrowRightLeft}
          iconClassName="bg-orange-50 text-orange-600"
          sub="Full amount buyers paid, not platform earnings"
        />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Earnings — last 30 days</CardTitle>
          <CardDescription>Buyer fees and organizer commissions, by day</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.trend.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No earnings recorded yet.</p>
          ) : (
            <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 180 }}>
              {data.trend.map((day) => (
                <div key={day.date} className="flex flex-1 min-w-[10px] flex-col items-center justify-end gap-1 h-full" title={`${day.date}: ${money(day.total)}`}>
                  <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                    <div
                      className="w-full rounded-t bg-violet-500"
                      style={{ height: `${Math.max(2, (day.commissions / maxTrendValue) * 100)}%` }}
                    />
                    <div
                      className="w-full bg-blue-500"
                      style={{ height: `${Math.max(2, (day.buyerFees / maxTrendValue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Buyer fees</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Commissions</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {data?.ticketsCounted ?? 0} ticket sale{data?.ticketsCounted === 1 ? "" : "s"} counted in these totals.
        Organizer commission rate is set platform-wide from Admin → Platform Configuration.
      </p>
    </div>
  );
}
