import { describe, it, expect } from "vitest";
import { isUuid, normalizeTicketCode } from "./validation";

describe("isUuid", () => {
  it("accepts a well-formed v4 UUID", () => {
    expect(isUuid("7e3e066e-3035-413a-a21d-ebc48da90397")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUuid("7E3E066E-3035-413A-A21D-EBC48DA90397")).toBe(true);
  });

  it("rejects a ticket QR code string", () => {
    expect(isUuid("ETKT-001-GHT24-MB-TM")).toBe(false);
  });

  it("rejects a malformed uuid-like string (wrong segment lengths)", () => {
    expect(isUuid("7e3e066e-3035-413a-a21d-ebc48da9039")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isUuid("")).toBe(false);
  });
});

describe("normalizeTicketCode", () => {
  const id = "7e3e066e-3035-413a-a21d-ebc48da90397";

  it("extracts the code from a validation URL (current QR format)", () => {
    expect(normalizeTicketCode(`https://www.eticket.co.zw/validate?code=${id}`)).toBe(id);
  });

  it("extracts the code from alternative URL param names", () => {
    expect(normalizeTicketCode(`https://www.eticket.co.zw/validate?tid=${id}`)).toBe(id);
    expect(normalizeTicketCode(`https://www.eticket.co.zw/validate?ticket=${id}`)).toBe(id);
  });

  it("extracts the ticketId from legacy JSON QR payloads", () => {
    expect(
      normalizeTicketCode(JSON.stringify({ ticketId: id, validationCode: "ETKT-DA90397" }))
    ).toBe(id);
  });

  it("passes raw uuids through unchanged", () => {
    expect(normalizeTicketCode(id)).toBe(id);
  });

  it("passes raw ID numbers through unchanged", () => {
    expect(normalizeTicketCode("63-123456A70")).toBe("63-123456A70");
  });

  it("trims whitespace", () => {
    expect(normalizeTicketCode(`  ${id}  `)).toBe(id);
  });

  it("returns the raw text for malformed JSON", () => {
    expect(normalizeTicketCode("{not json")).toBe("{not json");
  });

  it("returns the raw URL when it has no known code param", () => {
    expect(normalizeTicketCode("https://example.com/foo")).toBe("https://example.com/foo");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeTicketCode("")).toBe("");
  });
});
