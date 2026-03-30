"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n";
import { fetchBusinessPlace, updateBusinessPlace, fetchBusinessImages, type BusinessPlaceProfile, type BusinessImageDTO, type ChangeRequestInfo } from "@/lib/api/business-portal";
import { getStorageUrl } from "@/lib/utils/storage";
import { addImage, deleteImagePermanent } from "@/lib/api/images";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";

export default function PortalListing() {
  const t = useT();
  const { locale } = useLocale();
  const [place, setPlace] = useState<BusinessPlaceProfile | null>(null);
  const [images, setImages] = useState<BusinessImageDTO[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [address, setAddress] = useState("");

  const loadPlace = useCallback(async () => {
    try {
      const [data, imgs] = await Promise.all([
        fetchBusinessPlace(locale),
        fetchBusinessImages().catch(() => []),
      ]);
      setPlace(data);
      setImages(imgs);
      setChangeRequests(data.changeRequests ?? []);
      setName(data.name ?? "");
      setShortDescription(data.short_description ?? "");
      setDescription(data.description ?? "");
      setWebsiteUrl(data.website_url ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      setBookingUrl(data.booking_url ?? "");
      setAddress(data.address ?? "");
    } finally { setLoading(false); }
  }, [locale]);

  useEffect(() => { loadPlace(); }, [loadPlace]);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true); setToast(null);
    try {
      const result = await updateBusinessPlace({
        name: name || undefined,
        shortDescription: shortDescription || null,
        description: description || null,
        websiteUrl: websiteUrl || null,
        phone: phone || null,
        email: email || null,
        bookingUrl: bookingUrl || null,
        address: address || null,
      });
      const hasPending = result?.pendingApproval === true;
      showToast("success", hasPending ? t.pendingChanges.savedWithApproval : t.pendingChanges.savedSuccess);
      // Refresh change requests without resetting form
      try {
        const refreshed = await fetchBusinessPlace(locale);
        setChangeRequests(refreshed.changeRequests ?? []);
      } catch { /* ignore */ }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  };

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !place) return;
    if (visibleImages.length >= 4) return;
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `places/${place.id}/${Date.now()}.${ext}`;
      const bucket = 'place-images';
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      await addImage(place.id, { bucket, path: `${bucket}/${path}`, mimeType: file.type, sizeBytes: file.size });
      setImages(await fetchBusinessImages().catch(() => []));
    } catch { showToast("error", "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleImgDelete = async (imgId: string) => {
    if (!place || !confirm("Delete this image?")) return;
    setImgBusy(true);
    try {
      await deleteImagePermanent(place.id, imgId);
      setImages(await fetchBusinessImages().catch(() => []));
    } finally { setImgBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  if (!place) return <p className="text-muted py-10 text-center">{t.common.loading}</p>;

  const inputCls = "w-full rounded-xl border border-border px-3.5 py-3 text-sm text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/10 transition";
  const visibleImages = images.filter(i => i.image_role === 'hero' || i.image_role === 'cover' || i.image_role === 'gallery');

  // Per-field status from change requests
  const fieldStatus = (f: string): "pending" | "rejected" | null => {
    const cr = changeRequests.find(c => c.field_name === f);
    if (!cr) return null;
    if (cr.status === 'pending') return 'pending';
    if (cr.status === 'rejected') return 'rejected';
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">{t.listing.title}</h1>
        <p className="text-xs text-muted mt-0.5">{t.listing.subtitle}</p>
      </div>

      {/* Single temporary toast — appears and auto-hides */}
      {toast && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          )}
          {toast.text}
        </div>
      )}

      {/* Basic info */}
      <Section title={t.listing.basicInfo} desc={t.listing.basicInfoDesc}>
        <ApprovalField label={t.listing.name} status={fieldStatus('name')} t={t}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </ApprovalField>
        <ApprovalField label={t.listing.shortDescription} hint={t.listing.shortDescHint} status={fieldStatus('short_description')} t={t}>
          <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} maxLength={500} className={inputCls} />
          <p className="text-[10px] text-muted mt-0.5">{shortDescription.length}/500</p>
        </ApprovalField>
        <ApprovalField label={t.listing.fullDescription} hint={t.listing.fullDescHint} status={fieldStatus('full_description')} t={t}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={4000} className={inputCls} />
          <p className="text-[10px] text-muted mt-0.5">{description.length}/4000</p>
        </ApprovalField>
      </Section>

      {/* Contact */}
      <Section title={t.listing.contactLinks} desc={t.listing.contactLinksDesc}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InstantField label={t.listing.phone} t={t}>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 XXX XXX XXX" className={inputCls} />
          </InstantField>
          <InstantField label={t.listing.email} t={t}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@example.com" className={inputCls} />
          </InstantField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InstantField label={t.listing.website} t={t}>
            <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </InstantField>
          <InstantField label={t.listing.reservationLink} hint={t.listing.affiliateNote} t={t}>
            <input type="url" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://..." className={inputCls} />
          </InstantField>
        </div>
        <InstantField label={t.listing.address} t={t}>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
        </InstantField>
      </Section>

      {/* Images */}
      <Section title={t.listing.images} desc={t.listing.imagesDesc}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-muted">{t.listing.gallery}</p>
          <p className="text-[10px] text-muted">{Math.min(visibleImages.length, 4)} / 4 {t.listing.imagesIncluded}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {visibleImages.slice(0, 4).map((img) => {
            const url = getStorageUrl(img.bucket, img.path);
            return (
              <div key={img.id} className="aspect-[4/3] rounded-lg overflow-hidden border border-border bg-surface relative group">
                {url ? <img src={url} alt={img.caption ?? ""} className="w-full h-full object-cover" /> : <EmptySlot />}
                {(img.image_role === 'hero' || img.image_role === 'cover') && (
                  <span className="absolute top-1 left-1 bg-black/50 text-white text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded">Cover</span>
                )}
                <button onClick={() => handleImgDelete(img.id)} disabled={imgBusy} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:opacity-50">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 4 - visibleImages.length) }).map((_, i) => (
            <div key={`e-${i}`} className="aspect-[4/3] rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-white"><EmptySlot /></div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImgUpload} className="hidden" />
          {visibleImages.length < 4 && (
            <button onClick={() => fileRef.current?.click()} disabled={uploading || imgBusy} className="px-4 py-1.5 rounded-lg border border-border text-xs font-semibold text-text hover:border-gold/50 transition-colors bg-white cursor-pointer disabled:opacity-50">
              {uploading ? "..." : t.listing.gallery + " +"}
            </button>
          )}
          <p className="text-[10px] text-muted leading-relaxed">
            {t.listing.upgradeAvailable}{" "}
            <Link href="/portal/promote" className="text-gold font-medium hover:underline">{t.overview.promoteSpace} →</Link>
          </p>
        </div>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-20 md:bottom-0 bg-white/95 backdrop-blur-sm border-t border-border -mx-5 md:-mx-8 lg:-mx-12 px-5 md:px-8 lg:px-12 py-3 flex items-center justify-between z-10">
        <p className="text-xs text-muted">{t.listing.saveReady}</p>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">
          {saving ? t.common.saving : t.common.save}
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function EmptySlot() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D2B68A" strokeWidth="1.5" className="opacity-25"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-text">{title}</h2>
        <p className="text-[11px] text-muted mt-0.5">{desc}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function ApprovalField({ label, hint, status, t, children }: { label: string; hint?: string; status: "pending" | "rejected" | null; t: ReturnType<typeof import("@/lib/i18n").useT>; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-xs font-medium text-muted">{label}</label>
        {status === 'pending' && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{t.pendingChanges.pendingBadge}</span>}
        {status === 'rejected' && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">{t.pendingChanges.rejectedBadge}</span>}
        {!status && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{t.listing.requiresApproval}</span>}
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted mt-1 leading-relaxed">{hint}</p>}
      {status === 'pending' && <p className="text-[10px] text-amber-600 mt-1">{t.pendingChanges.fieldPendingHint}</p>}
      {status === 'rejected' && <p className="text-[10px] text-red-500 mt-1">{t.pendingChanges.fieldRejectedHint}</p>}
    </div>
  );
}

function InstantField({ label, hint, t, children }: { label: string; hint?: string; t: ReturnType<typeof import("@/lib/i18n").useT>; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-xs font-medium text-muted">{label}</label>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{t.listing.instant}</span>
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}
