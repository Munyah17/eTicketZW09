// Shared money math for ticket checkout and organizer payouts. Pulled out of
// the checkout form / API routes that used to each compute this inline —
// three slightly-different copies of the same percentage math is exactly
// the kind of thing that quietly drifts out of sync.

// Buyer-side service fee = percentage of the subtotal PLUS an optional
// fixed amount per order (e.g. 1.8% + $0.50). Either component can be 0.
// Buyers only ever see the combined "Processing Fee" total — never the
// rate or the split.
export function calculatePlatformFee(basePrice: number, feePercent: number, feeFixed = 0): number {
  return basePrice * (feePercent / 100) + feeFixed;
}

export function calculateTotalWithFee(basePrice: number, feePercent: number, feeFixed = 0): number {
  return basePrice + calculatePlatformFee(basePrice, feePercent, feeFixed);
}

export function calculatePayoutTransactionCost(amount: number, costPercent: number): number {
  return Number(((amount * costPercent) / 100).toFixed(2));
}

export function calculateNetPayout(amount: number, costPercent: number): number {
  return Number((amount - calculatePayoutTransactionCost(amount, costPercent)).toFixed(2));
}
