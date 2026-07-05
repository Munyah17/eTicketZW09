// Records a homepage banner view at most once per browser session, so
// re-renders/route changes don't inflate the marketing impression count.
export function recordBannerImpression(bannerId: string) {
  const key = `eticket:banner-seen:${bannerId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage unavailable (private mode etc) — fall through and record anyway.
  }
  fetch(`/api/banners/${bannerId}/impression`, { method: "POST" }).catch(() => {});
}
