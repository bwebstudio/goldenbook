// ─── NOW → Concierge context bridge ──────────────────────────────────────────
//
// Lightweight store that passes NOW context to Concierge when the user
// taps "Looking for something else?" or an adjustment button.
// The Concierge hook consumes and clears this on mount.

import { create } from 'zustand'

export type NowAdjustment = 'relax' | 'energy' | 'treat'

export interface NowContextForConcierge {
  city: string
  time_of_day: string
  weather: string | null
  moment: string | null
  moment_label: string | null
  source: 'now'
  adjustment?: NowAdjustment
}

interface NowContextState {
  pending: NowContextForConcierge | null
  set: (ctx: NowContextForConcierge) => void
  consume: () => NowContextForConcierge | null
}

export const useNowContextStore = create<NowContextState>((set, get) => ({
  pending: null,
  set: (ctx) => set({ pending: ctx }),
  consume: () => {
    const ctx = get().pending
    if (ctx) set({ pending: null })
    return ctx
  },
}))