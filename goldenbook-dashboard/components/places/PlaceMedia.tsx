"use client";

import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchPlaceImages, setCoverImage, reorderGallery, deleteImagePermanent, addImage, type PlaceImageDTO } from "@/lib/api/images";
import { getStorageUrl } from "@/lib/utils/storage";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";

const BASE_GALLERY_LIMIT = 4;
const MAX_GALLERY_LIMIT = 15;

interface Props {
  placeId: string;
  userRole?: string;
}

export default function PlaceMedia({ placeId, userRole = "editor" }: Props) {
  const router = useRouter();
  const [images, setImages] = useState<PlaceImageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = userRole === "super_admin";
  const canManageImages = true; // all roles can manage images
  const imageLimit = isSuperAdmin ? MAX_GALLERY_LIMIT : BASE_GALLERY_LIMIT;

  const load = useCallback(async () => {
    try { setImages(await fetchPlaceImages(placeId)); } catch { setImages([]); }
    finally { setLoading(false); }
  }, [placeId]);

  useEffect(() => { load(); }, [load]);

  const cover = images.find(i => i.image_role === 'hero' || i.image_role === 'cover') ?? images[0] ?? null;
  const gallery = images.filter(i => i.image_role === 'gallery').sort((a, b) => a.sort_order - b.sort_order);
  const allNonCover = images.filter(i => i.id !== cover?.id);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); router.refresh(); } finally { setBusy(false); }
  };

  const handleSetCover = (img: PlaceImageDTO) => withBusy(async () => { await setCoverImage(placeId, img.id); });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...gallery];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    withBusy(async () => { await reorderGallery(placeId, newOrder.map(i => i.id)); });
  };

  const handleMoveDown = (index: number) => {
    if (index >= gallery.length - 1) return;
    const newOrder = [...gallery];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    withBusy(async () => { await reorderGallery(placeId, newOrder.map(i => i.id)); });
  };

  const handleDelete = (img: PlaceImageDTO) => {
    if (!confirm("Permanently delete this image? This cannot be undone.")) return;
    withBusy(async () => { await deleteImagePermanent(placeId, img.id); });
  };

  const totalVisibleImages = images.filter(i => ['hero', 'cover', 'gallery'].includes(i.image_role)).length;
  const canUploadMore = totalVisibleImages < imageLimit;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canUploadMore) { alert(`Image limit reached (${imageLimit}).`); return; }

    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `places/${placeId}/${Date.now()}.${ext}`;
      const bucket = 'place-images';

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) throw error;

      await addImage(placeId, {
        bucket,
        path: `${bucket}/${path}`,
        mimeType: file.type,
        width: null,
        height: null,
        sizeBytes: file.size,
      });

      await load();
      router.refresh();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) return <p className="text-sm text-muted py-3">Loading images...</p>;
  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
        <p className="text-base font-medium">No images</p>
        <p className="text-sm mt-1 mb-3">Upload the first image for this place.</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-text hover:border-gold/50 transition-colors bg-white cursor-pointer disabled:opacity-50">
          {uploading ? "Uploading..." : "Upload image"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Cover Image ── */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Cover image</p>
        {cover ? (
          <div className="flex gap-4 items-start">
            <div className="relative w-48 aspect-video rounded-xl overflow-hidden border border-border shrink-0">
              <Image src={getStorageUrl(cover.bucket, cover.path) ?? ""} alt="Cover" fill className="object-cover" sizes="192px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text font-medium">This image is shown as the main photo in listings and the detail page.</p>
              <p className="text-xs text-muted mt-1">To change it, click the star icon on any gallery image.</p>
              {canManageImages && (
                <button onClick={() => handleDelete(cover)} disabled={busy} className="mt-2 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50">
                  Delete cover
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No cover image set.</p>
        )}
      </div>

      {/* ── Gallery ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Gallery</p>
          <p className="text-xs text-muted">
            <span className="font-semibold text-text">{gallery.length}</span>
            {" / "}
            <span>{BASE_GALLERY_LIMIT} included</span>
            {gallery.length > BASE_GALLERY_LIMIT && (
              <span className="text-amber-600 ml-1">({gallery.length - BASE_GALLERY_LIMIT} extra)</span>
            )}
          </p>
        </div>

        {gallery.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {gallery.map((img, index) => {
              const url = getStorageUrl(img.bucket, img.path);
              const isExtra = index >= BASE_GALLERY_LIMIT;
              return (
                <div key={img.id} className={`relative group rounded-xl overflow-hidden border ${isExtra ? "border-amber-200" : "border-border"}`}>
                  <div className="aspect-square relative">
                    <Image src={url ?? ""} alt={`Gallery ${index + 1}`} fill className="object-cover" sizes="180px" />
                  </div>
                  <span className="absolute top-2 left-2 bg-white/90 text-text text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    {index > 0 && (
                      <button onClick={() => handleMoveUp(index)} disabled={busy} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center cursor-pointer disabled:opacity-50" title="Move left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                    )}
                    {index < gallery.length - 1 && (
                      <button onClick={() => handleMoveDown(index)} disabled={busy} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center cursor-pointer disabled:opacity-50" title="Move right">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    )}
                    <button onClick={() => handleSetCover(img)} disabled={busy} className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-white cursor-pointer disabled:opacity-50" title="Set as cover">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                    {canManageImages && (
                      <button onClick={() => handleDelete(img)} disabled={busy} className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white cursor-pointer disabled:opacity-50" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No gallery images yet.</p>
        )}

        <p className="text-xs text-muted mt-3">
          Base plan includes {BASE_GALLERY_LIMIT} gallery images. Premium plans support up to {MAX_GALLERY_LIMIT}.
        </p>
      </div>

      {/* ── Upload ── */}
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || busy || !canUploadMore}
          className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-text hover:border-gold/50 transition-colors bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload image"}
        </button>
        {!canUploadMore && (
          <p className="text-xs text-muted">
            {isSuperAdmin
              ? `Limit reached (${MAX_GALLERY_LIMIT} images).`
              : `Limit reached (${BASE_GALLERY_LIMIT} images). Upgrade for up to ${MAX_GALLERY_LIMIT}.`}
          </p>
        )}
      </div>

      {/* ── Other images ── */}
      {allNonCover.filter(i => i.image_role !== 'gallery').length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Other images</p>
          <div className="flex gap-3 flex-wrap">
            {allNonCover.filter(i => i.image_role !== 'gallery').map(img => {
              const url = getStorageUrl(img.bucket, img.path);
              return (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border w-24">
                  <div className="aspect-square relative">
                    <Image src={url ?? ""} alt={img.image_role} fill className="object-cover" sizes="96px" />
                  </div>
                  <p className="text-[10px] text-muted text-center py-1">{img.image_role}</p>
                  <button onClick={() => handleDelete(img)} disabled={busy} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:opacity-50">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
