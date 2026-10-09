import { describe, it, expect } from "vitest";
import { fill, formatPct, formatSec, heatAlpha, keyLabel, shortDate } from "../format";

describe("formatSec", () => {
  it("formats seconds and minutes", () => {
    expect(formatSec(19)).toBe("19s");
    expect(formatSec(140.6)).toBe("2m 21s");
  });

  it("uses a plain hyphen placeholder, never an em dash", () => {
    expect(formatSec(0)).toBe("-");
    expect(formatSec(Number.NaN)).toBe("-");
  });
});

describe("formatPct", () => {
  it("renders the server-rounded value", () => {
    expect(formatPct(4.5, "pending")).toBe("4.5%");
    expect(formatPct(0, "pending")).toBe("0%");
  });

  it("never turns a missing value into 0%", () => {
    expect(formatPct(null, "pending")).toBe("pending");
    expect(formatPct(undefined, "-")).toBe("-");
  });
});

describe("fill", () => {
  it("replaces known slots and leaves unknown ones", () => {
    expect(fill("{zero} of {total}", { zero: 3, total: 10 })).toBe("3 of 10");
    expect(fill("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});

describe("keyLabel", () => {
  const labels = { search: "Search", deep_link: "External link" };

  it("labels null as the older-app bucket instead of hiding it", () => {
    expect(keyLabel(null, labels, "Unknown (older app)")).toBe("Unknown (older app)");
    expect(keyLabel("", labels, "Unknown (older app)")).toBe("Unknown (older app)");
  });

  it("uses the localized label, else a readable version of the key", () => {
    expect(keyLabel("deep_link", labels, "?")).toBe("External link");
    expect(keyLabel("natureza-outdoor", labels, "?")).toBe("natureza outdoor");
  });
});

describe("shortDate", () => {
  it("turns an ISO date into dd/mm", () => {
    expect(shortDate("2026-10-05")).toBe("05/10");
  });
});

describe("heatAlpha", () => {
  it("is transparent for pending, zero or empty columns", () => {
    expect(heatAlpha(null, 10)).toBe(0);
    expect(heatAlpha(0, 10)).toBe(0);
    expect(heatAlpha(5, 0)).toBe(0);
  });

  it("darkens with the value, strongest cell at the column max", () => {
    expect(heatAlpha(10, 10)).toBeCloseTo(0.68);
    expect(heatAlpha(5, 10)).toBeLessThan(heatAlpha(10, 10));
  });
});
