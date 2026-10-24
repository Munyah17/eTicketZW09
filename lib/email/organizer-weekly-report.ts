// Weekly organizer report email — a financial digest of the last 7 days:
// tickets sold, gross sales, platform commission, net earnings, per-event
// breakdown, upcoming events, and payout status. Table-based layout with
// inline styles only (email clients, not browsers).

export interface EventReportRow {
  eventId: string;
  title: string;
  ticketsSold: number;
  grossSales: number;
  netEarnings: number;
}

export interface CurrencyReport {
  currency: string;
  ticketsSold: number;
  grossSales: number; // what buyers paid (sum of total_paid)
  onlineSales: number;
  gateSales: number;
  platformCommission: number;
  netEarnings: number; // sum(price) - sum(platform_commission)
  events: EventReportRow[];
}

export interface UpcomingEvent {
  title: string;
  date: string; // ISO date
  sold: number;
  total: number;
}

export interface PayoutActivity {
  amount: number;
  currency: string;
  status: string;
  requestedAt: string;
}

export interface OrganizerWeeklyReport {
  organizerName: string;
  organizerEmail: string;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  pendingPayout: number;
  pendingPayoutCurrency: string;
  currencies: CurrencyReport[];
  upcomingEvents: UpcomingEvent[];
  recentPayouts: PayoutActivity[];
}

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://www.eticket.co.zw";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${formatted}` : `${currency} ${formatted}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function kpi(label: string, value: string, sub: string, valueColor = "#0f172a"): string {
  return `
    <td style="width: 50%; padding: 4px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">${label}</div>
        <div style="font-size: 22px; font-weight: 700; color: ${valueColor}; margin-top: 2px;">${value}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${sub}</div>
      </div>
    </td>`;
}

function currencySection(c: CurrencyReport): string {
  const eventRows = c.events
    .map(
      (e) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">${esc(e.title)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: center;">${e.ticketsSold}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right;">${money(e.grossSales, c.currency)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right; font-weight: 600; color: #166534;">${money(e.netEarnings, c.currency)}</td>
      </tr>`
    )
    .join("");

  const eventsTable =
    c.events.length > 0
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <tr style="background: #f1f5f9;">
          <td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Event</td>
          <td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; text-align: center;">Sold</td>
          <td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; text-align: right;">Gross</td>
          <td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; text-align: right;">Net</td>
        </tr>
        ${eventRows}
      </table>`
      : `<p style="font-size: 13px; color: #64748b; margin: 16px 0 0;">No ticket sales this week.</p>`;

  const channelNote =
    c.gateSales > 0
      ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Online ${money(c.onlineSales, c.currency)} · Gate ${money(c.gateSales, c.currency)}</div>`
      : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
      <tr>
        ${kpi("Tickets Sold", String(c.ticketsSold), "completed sales this week")}
        ${kpi("Gross Sales", money(c.grossSales, c.currency), "total paid by buyers" + (c.gateSales > 0 ? "" : ""), "#0f172a")}
      </tr>
      <tr>
        ${kpi("Platform Fees", money(c.platformCommission, c.currency), "commission deducted", "#b45309")}
        ${kpi("Net Earnings", money(c.netEarnings, c.currency), "your share after fees", "#166534")}
      </tr>
    </table>
    ${channelNote}
    ${eventsTable}`;
}

export function buildWeeklyReportHtml(r: OrganizerWeeklyReport): string {
  const period = `${fmtDate(r.periodStart)} – ${fmtDate(r.periodEnd)}`;

  const sections = r.currencies.map(currencySection).join(`
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`);

  const upcomingRows = r.upcomingEvents
    .slice(0, 5)
    .map((e) => {
      const pct = e.total > 0 ? Math.round((e.sold / e.total) * 100) : 0;
      return `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          ${esc(e.title)}
          <div style="font-size: 11px; color: #94a3b8;">${fmtDate(e.date)}</div>
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right; white-space: nowrap;">
          ${e.sold}/${e.total} <span style="color: #94a3b8; font-size: 11px;">(${pct}%)</span>
        </td>
      </tr>`;
    })
    .join("");

  const upcomingBlock =
    r.upcomingEvents.length > 0
      ? `
      <h2 style="font-size: 14px; margin: 28px 0 8px; color: #0f172a;">Upcoming events</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${upcomingRows}</table>`
      : "";

  const payoutRows = r.recentPayouts
    .map(
      (p) => `
      <tr>
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">${fmtDate(p.requestedAt)}</td>
        <td style="padding: 6px 0; font-size: 13px; text-align: right;">${money(p.amount, p.currency)}</td>
        <td style="padding: 6px 0; font-size: 12px; text-align: right; text-transform: capitalize; color: ${p.status === "approved" ? "#166534" : p.status === "declined" ? "#b91c1c" : "#b45309"};">${esc(p.status)}</td>
      </tr>`
    )
    .join("");

  const payoutBlock = `
    <h2 style="font-size: 14px; margin: 28px 0 8px; color: #0f172a;">Payouts</h2>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #166534;">Available balance</div>
      <div style="font-size: 20px; font-weight: 700; color: #166534;">${money(r.pendingPayout, r.pendingPayoutCurrency)}</div>
    </div>
    ${
      r.recentPayouts.length > 0
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">${payoutRows}</table>`
        : `<p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0;">No payout requests this week.</p>`
    }`;

  return `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #f1f5f9;">
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px 12px; color: #0f172a;">
    <div style="background: #0f172a; color: #fff; padding: 24px 28px; border-radius: 12px 12px 0 0;">
      <div style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #4ade80;">E-TicketsZW</div>
      <h1 style="margin: 6px 0 0; font-size: 22px;">Weekly Organizer Report</h1>
      <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${period}</div>
    </div>
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 28px; border-radius: 0 0 12px 12px;">
      <p style="font-size: 14px; margin: 0 0 16px;">Hi ${esc(r.organizerName)}, here&apos;s how your events performed this week.</p>
      ${sections}
      ${upcomingBlock}
      ${payoutBlock}
      <div style="text-align: center; margin-top: 28px;">
        <a href="${SITE_URL}/creator" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">Open your dashboard</a>
      </div>
    </div>
    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 16px 0 0;">
      You&apos;re receiving this weekly report because you&apos;re an organizer on E-TicketsZW.<br/>
      Figures cover completed sales from ${period}. Gate sales are included in the totals above.
    </p>
  </div>
</body>
</html>`;
}

export function weeklyReportSubject(r: OrganizerWeeklyReport): string {
  const totalSold = r.currencies.reduce((n, c) => n + c.ticketsSold, 0);
  const primary = r.currencies[0];
  const net = primary ? money(primary.netEarnings, primary.currency) : "$0.00";
  return `Your week on E-TicketsZW: ${totalSold} ticket${totalSold === 1 ? "" : "s"} sold, ${net} net`;
}
