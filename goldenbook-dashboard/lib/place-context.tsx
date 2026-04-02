"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setActivePlaceId } from "@/lib/api/client";
import { fetchBusinessMe, type BusinessPlaceSummary } from "@/lib/api/business-portal";

interface PlaceContextValue {
  places: BusinessPlaceSummary[];
  activePlace: BusinessPlaceSummary | null;
  setActivePlace: (placeId: string) => void;
  loading: boolean;
}

const PlaceContext = createContext<PlaceContextValue>({
  places: [],
  activePlace: null,
  setActivePlace: () => {},
  loading: true,
});

export function usePlaceContext() {
  return useContext(PlaceContext);
}

function getStoredPlaceId(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )gb_active_place_id=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<BusinessPlaceSummary[]>([]);
  const [activePlaceId, setActivePlaceIdState] = useState<string | null>(getStoredPlaceId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinessMe()
      .then((me) => {
        const p = me.places ?? [];
        setPlaces(p);

        if (p.length > 0) {
          const stored = getStoredPlaceId();
          const valid = p.find((pl) => pl.id === stored);
          const selected = valid ?? p[0];
          setActivePlaceIdState(selected.id);
          setActivePlaceId(selected.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activePlace = places.find((p) => p.id === activePlaceId) ?? null;

  function handleSetActivePlace(placeId: string) {
    setActivePlaceIdState(placeId);
    setActivePlaceId(placeId);
  }

  return (
    <PlaceContext value={{ places, activePlace, setActivePlace: handleSetActivePlace, loading }}>
      {children}
    </PlaceContext>
  );
}
