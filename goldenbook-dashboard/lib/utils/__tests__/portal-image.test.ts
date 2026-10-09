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

describe("upload size cap", () => {
  it("stays below Vercel's 4.5 MB function body limit", async () => {
    const { UPLOAD_MAX_BYTES } = await import("../image");
    expect(UPLOAD_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("plans lower quality first, then smaller sizes, never upscaling", async () => {
    const { shrinkPlan } = await import("../image");
    const plan = shrinkPlan(2560, 1440);
    expect(plan[0]).toEqual({ width: 2560, height: 1440, quality: 0.72 });
    expect(plan[1].quality).toBeLessThan(plan[0].quality);
    for (let i = 3; i < plan.length; i++) {
      expect(plan[i].width).toBeLessThan(plan[i - 1].width);
      expect(plan[i].width / plan[i].height).toBeCloseTo(2560 / 1440, 1);
    }
  });
});
