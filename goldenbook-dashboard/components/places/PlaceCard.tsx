import Image from "next/image";
import Link from "next/link";
import StatusBadge from "@/components/places/StatusBadge";
import type { UIPlace } from "@/types/ui/place";

// Warm gradient placeholder per first-letter bucket when no image is available
const PLACEHOLDER_GRADIENTS = [
  "from-[#F5E6C8] to-[#E8C98A]",
  "from-[#F5D5C8] to-[#E8A08A]",
  "from-[#D5C8F5] to-[#A08AE8]",
  "from-[#C8F5D5] to-[#8AE8A0]",
  "from-[#C8E0F5] to-[#8AC0E8]",
  "from-[#F5C8E0] to-[#E88AC0]",
  "from-[#F5EAC8] to-[#E8C88A]",
];

function placeholderGradient(name: string): string {
  const index = name.charCodeAt(0) % PLACEHOLDER_GRADIENTS.length;
  return PLACEHOLDER_GRADIENTS[index];
}

function PlaceholderImage({ name }: { name: string }) {
  const gradient = placeholderGradient(name);
  return (
    <div className={`w-full h-full bg-linear-to-br ${gradient} flex items-center justify-center`}>
      <span className="text-3xl font-bold text-white/80 select-none">
        {name.charAt(0)}
      </span>
    </div>
  );
}

interface PlaceCardProps {
  place: UIPlace;
}

export default function PlaceCard({ place }: PlaceCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-gold/40 transition-all flex overflow-hidden">
      {/* Image — real or placeholder */}
      <div className="w-36 shrink-0 relative overflow-hidden">
        {place.mainImage ? (
          <Image
            src={place.mainImage}
            alt={place.name}
            fill
            className="object-cover"
            sizes="144px"
          />
        ) : (
          <PlaceholderImage name={place.name} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5 flex flex-col justify-between min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold text-text leading-tight">
                {place.name}
              </h3>
              <StatusBadge status={place.status} />
              {place.featured && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold/15 text-gold">
                  ★ Featured
                </span>
              )}
              {place.editorsPick && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-text/8 text-text">
                  Editor&apos;s Pick
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {place.city}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                {place.category}
              </span>
              {place.address && (
                <span className="text-sm text-muted truncate">{place.address}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions — edit links to /places/{slug} */}
        <div className="flex items-center gap-3 mt-4">
          <Link
            href={`/places/${place.slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
          <Link
            href={`/places/${place.slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-gold/50 hover:text-text transition-colors bg-white"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
