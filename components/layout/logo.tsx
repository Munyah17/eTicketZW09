"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// The lockup's "eTicket" wordmark is dark navy — needs a light variant to
// stay legible on dark backgrounds. logo-lockup-dark.png is the same mark
// with that text recolored white; the ticket-badge icon is unchanged since
// its own blue fill already reads fine on both themes.
export function Logo({ className, height = 36 }: { className?: string; height?: number }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Image
      src={isDark ? "/logo-lockup-dark.png" : "/logo-lockup.png"}
      alt="E-TicketsZW"
      width={1296}
      height={264}
      priority
      className={cn("w-auto", className)}
      style={{ height }}
    />
  );
}
