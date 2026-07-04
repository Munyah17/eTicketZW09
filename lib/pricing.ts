// Shared money math for ticket checkout and organizer payouts. Pulled out of
// the checkout form / API routes that used to each compute this inline —
// three slightly-different copies of the same percentage math is exactly
// the kind of thing that quietly drifts out of sync.

export function calculatePlatformFee(basePrice: number, feePercent: number): number {
  return basePrice * (feePercent / 100);
}

export function calculateTotalWithFee(basePrice: number, feePercent: number): number {
  return basePrice + calculatePlatformFee(basePrice, feePercent);
}

export function calculatePayoutTransactionCost(amount: number, costPercent: number): number {
  return Number(((amount * costPercent) / 100).toFixed(2));
}

export function calculateNetPayout(amount: number, costPercent: number): number {
  return Number((amount - calculatePayoutTransactionCost(amount, costPercent)).toFixed(2));
}
