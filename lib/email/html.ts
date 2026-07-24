// Small shared HTML helpers for the plain-table transactional email style
// used across lib/email/*. Kept minimal on purpose — these emails are read
// in inboxes with inconsistent CSS support, not rendered in a browser.
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function wrapper(accentColor: string, heading: string, bodyHtml: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <div style="background: ${accentColor}; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 18px;">${heading}</h1>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function row(label: string, value: string): string {
  return `<tr><td style="padding: 6px 0; color: #64748b;">${label}</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${value}</td></tr>`;
}
