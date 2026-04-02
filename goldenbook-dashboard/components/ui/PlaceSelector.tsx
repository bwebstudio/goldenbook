"use client";

import { useState } from "react";
import { usePlaceContext } from "@/lib/place-context";

export default function PlaceSelector() {
  const { places, activePlace, setActivePlace } = usePlaceContext();
  const [open, setOpen] = useState(false);

  if (places.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#EDE9E3] bg-white text-sm font-medium text-[#222D52] hover:bg-[#F9F7F2] transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span className="truncate max-w-[160px]">{activePlace?.name ?? "Select place"}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl border border-[#EDE9E3] shadow-lg py-1 w-64 z-50">
            {places.map((place) => (
              <button
                key={place.id}
                onClick={() => {
                  setActivePlace(place.id);
                  setOpen(false);
                  window.location.reload();
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center justify-between ${
                  place.id === activePlace?.id
                    ? "bg-[#D2B68A]/10 text-[#D2B68A] font-semibold"
                    : "text-[#222D52] hover:bg-[#F9F7F2]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{place.name}</p>
                  {place.cityName && (
                    <p className="text-[10px] text-[#6B6B7B] mt-0.5">{place.cityName}</p>
                  )}
                </div>
                {place.id === activePlace?.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 ml-2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
