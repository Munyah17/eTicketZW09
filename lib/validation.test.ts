import { describe, it, expect } from "vitest";
import { isUuid } from "./validation";

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
