import { describe, it, expect } from "vitest";
import {
  calculatePlatformFee,
  calculateTotalWithFee,
  calculatePayoutTransactionCost,
  calculateNetPayout,
} from "./pricing";

describe("calculatePlatformFee", () => {
  it("computes the fee as a percentage of the base price", () => {
    expect(calculatePlatformFee(100, 10)).toBe(10);
    expect(calculatePlatformFee(50, 5)).toBe(2.5);
  });

  it("returns 0 when the base price is 0", () => {
    expect(calculatePlatformFee(0, 10)).toBe(0);
  });

  it("returns 0 when the fee percent is 0", () => {
    expect(calculatePlatformFee(100, 0)).toBe(0);
  });
});

describe("calculateTotalWithFee", () => {
  it("adds the fee on top of the base price", () => {
    expect(calculateTotalWithFee(100, 10)).toBe(110);
  });

  it("matches base price when fee percent is 0", () => {
    expect(calculateTotalWithFee(75, 0)).toBe(75);
  });
});

describe("calculatePayoutTransactionCost", () => {
  it("computes and rounds the cost to 2 decimal places", () => {
    expect(calculatePayoutTransactionCost(100, 5)).toBe(5);
    expect(calculatePayoutTransactionCost(33.333, 5)).toBeCloseTo(1.67, 2);
  });
});

describe("calculateNetPayout", () => {
  it("subtracts the transaction cost from the requested amount", () => {
    expect(calculateNetPayout(100, 5)).toBe(95);
  });

  it("rounds to 2 decimal places", () => {
    const net = calculateNetPayout(33.333, 5);
    expect(Number.isFinite(net)).toBe(true);
    expect(net.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});
