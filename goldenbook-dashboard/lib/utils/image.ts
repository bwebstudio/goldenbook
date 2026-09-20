// ─── Image preparation before upload ───────────────────────────────────────
//
// Uploads used to send the editor's file to Supabase Storage untouched. The
// picker accepts `image/*`, so camera and print originals went straight into
// the bucket: at the time of the storage audit, 58 objects held 987 MB, with
// individual JPEGs at 46 MB and several TIFFs at 36 MB. Nothing in the app
// can display a TIFF, and nothing needs a 46 MB JPEG — the largest rendering
// is a full-bleed hero on a phone.
//
// That growth is what pushed the project past its Supabase storage quota and
// took the whole project offline. Deleting the leaked objects recovers the
// space once; resizing here is what stops it coming back.
//
// Everything is done with canvas, so there is no dependency to add and no
// server round-trip.

/** Longest edge we keep. Comfortably above any rendering the app does. */
const MAX_EDGE = 2560;
/** JPEG quality. 0.82 is visually clean for photography at this size. */
const JPEG_QUALITY = 0.82;
/** Files at or below this are passed through untouched if already web-safe. */
const PASSTHROUGH_BYTES = 400 * 1024;

/** Formats every browser can decode and every client can render. */
const WEB_SAFE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class UnsupportedImageError extends Error {
  constructor(public readonly mimeType: string) {
    super(`Unsupported image format: ${mimeType || 'unknown'}`);
    this.name = 'UnsupportedImageError';
  }
}

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
  /** False when the original was returned as-is. */
  recompressed: boolean;
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    // A decode failure here is how TIFF and other non-web formats surface:
    // the browser simply cannot read them, which is also why the app could
    // never have displayed them.
    img.onerror = () => { URL.revokeObjectURL(url); reject(new UnsupportedImageError(file.type)); };
    img.src = url;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Could not encode the resized image')); return; }
        resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Downscale and re-encode an image chosen by an editor.
 *
 * Small files already in a web format are returned untouched, so re-uploading
 * an asset that has been through here once does not lose quality a second
 * time. Anything else is capped at {@link MAX_EDGE} on its longest edge and
 * re-encoded as JPEG.
 *
 * Throws {@link UnsupportedImageError} for formats the browser cannot decode
 * (TIFF, HEIC on some platforms). Rejecting at the picker is deliberate: such
 * a file would upload fine, consume quota, and then render as a broken image
 * everywhere.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new UnsupportedImageError(file.type);
  if (!WEB_SAFE.has(file.type)) throw new UnsupportedImageError(file.type);

  const img = await loadBitmap(file);
  const { naturalWidth: w, naturalHeight: h } = img;

  const longest = Math.max(w, h);
  const needsResize = longest > MAX_EDGE;

  if (!needsResize && file.size <= PASSTHROUGH_BYTES) {
    return { file, width: w, height: h, recompressed: false };
  }

  const scale = needsResize ? MAX_EDGE / longest : 1;
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, width: w, height: h, recompressed: false };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  const out = await canvasToFile(canvas, `${baseName}.jpg`);

  // Re-encoding a small, already-optimised file can make it bigger. Keep
  // whichever is smaller, as long as we did not need the resize.
  if (!needsResize && out.size >= file.size) {
    return { file, width: w, height: h, recompressed: false };
  }

  return { file: out, width: targetW, height: targetH, recompressed: true };
}
