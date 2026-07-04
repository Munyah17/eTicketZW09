"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, Lock, Info, ArrowRight } from "lucide-react";
import { ONLINE_PAYMENT_PROVIDERS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PaymentProvidersProps {
  amount: number;
  onSelect: (providerId: string) => void;
  selectedProvider?: string | null;
}

export function PaymentProviders({ amount, onSelect, selectedProvider }: PaymentProvidersProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [comingSoonProvider, setComingSoonProvider] = useState<string | null>(null);

  const handleSelect = (providerId: string) => {
    const provider = ONLINE_PAYMENT_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    if (!provider.active) {
      setComingSoonProvider(providerId);
      return;
    }

    setLoadingProvider(providerId);
    onSelect(providerId);
    setTimeout(() => setLoadingProvider(null), 500);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select your preferred payment method to complete your purchase of{" "}
        <strong className="font-mono">${amount.toFixed(2)}</strong>
      </p>

      {ONLINE_PAYMENT_PROVIDERS.map((provider) => (
        <Card
          key={provider.id}
          className={cn(
            "overflow-hidden transition-all cursor-pointer",
            selectedProvider === provider.id && "ring-2 ring-primary",
            !provider.active && "opacity-60 cursor-not-allowed"
          )}
          onClick={() => handleSelect(provider.id)}
        >
          <CardContent className="p-0">
            {/* Banner Image */}
            <div className="w-full bg-white flex items-center justify-center p-3 border-b">
              <img
                src={provider.banner}
                alt={`${provider.name} payment banner`}
                className="w-full max-h-28 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{provider.name}</h4>
                  {provider.active ? (
                    <Badge variant="default" className="bg-success text-success-foreground gap-1">
                      <Lock className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
              </div>

              {selectedProvider === provider.id ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </div>
              ) : provider.active ? (
                <Button size="sm" variant="outline" disabled={loadingProvider === provider.id}>
                  {loadingProvider === provider.id ? "..." : `Pay with ${provider.name}`}
                </Button>
              ) : (
                <Button size="sm" variant="outline">
                  {`Pay with ${provider.name}`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Coming Soon Dialog */}
      <Dialog open={!!comingSoonProvider} onOpenChange={() => setComingSoonProvider(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-500" />
              Coming Soon
            </DialogTitle>
            <DialogDescription>
              {ONLINE_PAYMENT_PROVIDERS.find((p) => p.id === comingSoonProvider)?.name} is not yet available
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This payment method is not yet available. Please use one of our active gateways:
            </p>

            <div className="space-y-3">
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="font-semibold">Paynow</p>
                  <Badge className="bg-emerald-500">Available</Badge>
                </CardContent>
              </Card>

              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="font-semibold">Stripe</p>
                  <Badge className="bg-blue-500">Available</Badge>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setComingSoonProvider(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
