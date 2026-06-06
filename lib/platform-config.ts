"use client";

export interface PlatformConfig {
  serviceFeePercent: number;
  features: {
    newRegistrations: boolean;
    newOrganizerSignups: boolean;
    maintenanceMode: boolean;
    onlinePayments: boolean;
    stripeEnabled: boolean;
    paynowEnabled: boolean;
  };
  announcement: {
    active: boolean;
    message: string;
    type: "info" | "warning" | "error";
  };
}

const CONFIG_KEY = "eticket_platform_config";

const DEFAULT_CONFIG: PlatformConfig = {
  serviceFeePercent: 10,
  features: {
    newRegistrations: true,
    newOrganizerSignups: true,
    maintenanceMode: false,
    onlinePayments: true,
    stripeEnabled: true,
    paynowEnabled: true,
  },
  announcement: {
    active: false,
    message: "",
    type: "info",
  },
};

export function getPlatformConfig(): PlatformConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function savePlatformConfig(config: PlatformConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function resetPlatformConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONFIG_KEY);
}
