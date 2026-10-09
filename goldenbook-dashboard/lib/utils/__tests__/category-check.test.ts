import { describe, it, expect } from "vitest";
import { isPlaceTypeCategoryMismatch } from "../category-check";

describe("isPlaceTypeCategoryMismatch", () => {
  it("flags a restaurant outside gastronomy", () => {
    expect(isPlaceTypeCategoryMismatch("restaurant", "alojamento")).toBe(true);
    expect(isPlaceTypeCategoryMismatch("restaurant", "retail")).toBe(true);
  });

  it("accepts the expected category and the experiences catch-all", () => {
    expect(isPlaceTypeCategoryMismatch("restaurant", "gastronomy")).toBe(false);
    expect(isPlaceTypeCategoryMismatch("hotel", "experiences")).toBe(false);
    expect(isPlaceTypeCategoryMismatch("landmark", "natureza-outdoor")).toBe(false);
  });

  it("never flags broad types, unknown categories or missing values", () => {
    expect(isPlaceTypeCategoryMismatch("activity", "gastronomy")).toBe(false);
    expect(isPlaceTypeCategoryMismatch("other", "retail")).toBe(false);
    expect(isPlaceTypeCategoryMismatch("restaurant", "nova-categoria")).toBe(false);
    expect(isPlaceTypeCategoryMismatch("restaurant", "")).toBe(false);
    expect(isPlaceTypeCategoryMismatch(undefined, "retail")).toBe(false);
  });
});
