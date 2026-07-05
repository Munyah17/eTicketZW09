"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";

interface Announcement {
  active: boolean;
  message: string;
  type: "info" | "warning" | "error" | "ad";
  image?: string | null;
  link?: string | null;
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
            image: data.config.announcement_image,
            link: data.config.announcement_link,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!announcement?.active || dismissed) return null;

  // Ad mode is visually distinct from a system notice — a neutral "Sponsored"
  // strip with the advertiser's image, not the solid alert-colored bar used
  // for info/warning/error, so visitors never mistake one for the other.
  if (announcement.type === "ad") {
    if (!announcement.image) return null;
    return (
      <div className="border-b bg-muted/60">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5">
          <Link href={announcement.link || "#"} className="flex flex-1 items-center gap-3 min-w-0">
            <span className="shrink-0 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-widest text-background">
              Sponsored
            </span>
            <img src={announcement.image} alt="Sponsored" className="h-9 flex-1 rounded object-cover" />
          </Link>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss ad" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!announcement.message) return null;
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
