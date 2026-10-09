import { describe, it, expect } from "vitest";
import { isHeic, PORTAL_IMAGE_ACCEPT } from "../portal-image";

const file = (name: string, type: string) => new File([new Uint8Array([1])], name, { type });

describe("isHeic", () => {
  it("detects iPhone photos by MIME type or extension", () => {
    expect(isHeic(file("IMG_0001.HEIC", ""))).toBe(true);
    expect(isHeic(file("photo.jpg", "image/heic"))).toBe(true);
    expect(isHeic(file("photo.heif", "image/heif"))).toBe(true);
  });

  it("leaves web formats alone", () => {
    expect(isHeic(file("photo.jpg", "image/jpeg"))).toBe(false);
    expect(isHeic(file("photo.webp", "image/webp"))).toBe(false);
  });
});

describe("PORTAL_IMAGE_ACCEPT", () => {
  it("only offers the formats the bucket accepts", () => {
    expect(PORTAL_IMAGE_ACCEPT.split(",").sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
