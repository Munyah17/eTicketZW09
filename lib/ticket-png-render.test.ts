import { describe, it, expect } from "vitest";
import { renderTicketPng } from "./ticket-png";

describe("renderTicketPng", () => {
  it("renders a landscape PNG with QR, seat, and branding", async () => {
    const png = await renderTicketPng({
      id: "7e3e066e-3035-413a-a21d-ebc48da90397",
      eventTitle: "Test Comedy Night",
      eventDate: "2026-08-15",
      eventTime: "19:00",
      venue: "Harare International Conference Centre",
      ticketTypeName: "VIP",
      buyerName: "Munyaradzi Muzvidziwa",
      buyerDisplayName: "Munyaradzi M.",
      buyerEmail: "test@example.com",
      totalPaid: 15,
      currency: "USD",
      paymentMethod: "paynow",
      purchasedAt: new Date().toISOString(),
      seatNumber: "B12",
    });
    // PNG magic bytes prove we produced a real image, not an error payload
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(10000);
  }, 60000);

  it("renders without a seat number (optional field)", async () => {
    const png = await renderTicketPng({
      id: "7e3e066e-3035-413a-a21d-ebc48da90397",
      eventTitle: "General Event",
      eventDate: "2026-08-15",
      eventTime: "10:00",
      venue: "Venue",
      ticketTypeName: "Standard",
      buyerName: "Jane Doe",
      buyerDisplayName: "Jane D.",
      buyerEmail: "jane@example.com",
      totalPaid: 5,
      currency: "USD",
      paymentMethod: "stripe",
      purchasedAt: new Date().toISOString(),
    });
    expect(png.length).toBeGreaterThan(10000);
  }, 60000);
});
