// ─── Image preparation for the business portal ─────────────────────────────
//
// Same resize and JPEG recompression as the employee editor
// (prepareImageForUpload), plus two things the portal needs:
//
//  - HEIC/HEIF (iPhone photos copied to a Mac, for instance) are tried
//    through the browser's own decoder first. Safari can decode them, so
//    they are redrawn on a canvas and become a JPEG; browsers that cannot
//    (Chrome, Firefox) end in a HEIC-specific error the page can explain.
//  - A final size check against the bucket's 10 MB limit, so the client is
//    told before anything is sent.

import { prepareImageForUpload, UnsupportedImageError, type PreparedImage } from "./image";

export const PORTAL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const PORTAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type PortalImageErrorReason = "heic" | "unsupported" | "tooLarge";

export class PortalImageError extends Error {
  constructor(public readonly reason: PortalImageErrorReason) {
    super(`Portal image rejected: ${reason}`);
    this.name = "PortalImageError";
  }
}

export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return type === "image/heic" || type === "image/heif" ||
    type === "image/heic-sequence" || type === "image/heif-sequence" ||
    /\.(heic|heif)$/i.test(file.name);
}

/** Decode with the browser and re-encode as JPEG. Rejects if it cannot decode. */
function heicToJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width || !canvas.height) { reject(new PortalImageError("heic")); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new PortalImageError("heic")); return; }
        const name = (file.name.replace(/\.[^.]+$/, "") || "image") + ".jpg";
        resolve(new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }));
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new PortalImageError("heic")); };
    img.src = url;
  });
}

export async function preparePortalImage(file: File): Promise<PreparedImage> {
  let source = file;
  if (isHeic(file)) source = await heicToJpeg(file);

  let prepared: PreparedImage;
  try {
    prepared = await prepareImageForUpload(source);
  } catch (err) {
    if (err instanceof UnsupportedImageError) throw new PortalImageError("unsupported");
    throw err;
  }

  if (prepared.file.size > PORTAL_IMAGE_MAX_BYTES) throw new PortalImageError("tooLarge");
  return prepared;
}
