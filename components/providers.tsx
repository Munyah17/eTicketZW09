"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "next-themes";

// next-themes persists a manual light/dark toggle to localStorage, so it
// would otherwise stick forever. Each fresh visit should instead reflect
// whatever the device is currently set to — the toggle still works for the
// rest of the session, it just doesn't survive a reload.
function ResetThemeToDeviceOnLoad() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme !== "system") setTheme("system");
    // Only on mount — a later system-vs-toggle mismatch is the user's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ResetThemeToDeviceOnLoad />
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
