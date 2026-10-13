// Small shared HTML helpers for the plain-table transactional email style
// used across lib/email/*. Kept minimal on purpose — these emails are read
// in inboxes with inconsistent CSS support, not rendered in a browser.
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function wrapper(accentColor: string, heading: string, bodyHtml: string): string {
  return `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #f4f6f8; padding: 32px 16px; color: #0f172a;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="height: 4px; background: ${accentColor};"></div>
        <div style="padding: 24px 28px 0;">
          <p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #059669;">E-TicketsZW</p>
          <h1 style="margin: 8px 0 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #0f172a;">${heading}</h1>
        </div>
        <div style="padding: 20px 28px 28px; font-size: 15px; line-height: 1.6; color: #334155;">
          ${bodyHtml}
        </div>
      </div>
      <div style="max-width: 520px; margin: 16px auto 0; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          E-TicketsZW · <a href="https://eticket.co.zw" style="color: #059669; text-decoration: none;">eticket.co.zw</a> · info@eticket.co.zw
        </p>
        <p style="margin: 6px 0 0; font-size: 11px; color: #b6c0cc;">Replies to this email reach our team directly.</p>
      </div>
    </div>
  `;
}

export function row(label: string, value: string): string {
  return `<tr><td style="padding: 6px 0; color: #64748b;">${label}</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${value}</td></tr>`;
}
