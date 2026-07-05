import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  className?: string;
  sub?: string;
  footer?: ReactNode;
}

// Shared stat/KPI tile — smooth rounded-xl icon box + label/value — used
// across every admin and organizer dashboard so counts read the same way
// everywhere instead of each page inventing its own card shape.
export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
  valueClassName,
  className,
  sub,
  footer,
}: StatCardProps) {
  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconClassName)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-0.5 text-xl font-mono font-bold", valueClassName)}>{value}</p>
            {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
