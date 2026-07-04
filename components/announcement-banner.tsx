"use client";

import { useEffect, useState } from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";

interface Announcement {
  active: boolean;
  message: string;
  type: "info" | "warning" | "error";
}

const STYLES = {
  info: { bg: "bg-blue-600", icon: Info },
  warning: { bg: "bg-amber-600", icon: AlertTriangle },
  error: { bg: "bg-red-600", icon: AlertCircle },
} as const;

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/platform-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setAnnouncement({
            active: data.config.announcement_active,
            message: data.config.announcement_message,
            type: data.config.announcement_type,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!announcement?.active || !announcement.message || dismissed) return null;

  const style = STYLES[announcement.type] ?? STYLES.info;
  const Icon = style.icon;

  return (
    <div className={`${style.bg} text-white`}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="flex-1">{announcement.message}</p>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss announcement">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
