// ─── PlaceNowVisibility: time-window sanitisation ──────────────────────────
//
// Regression cover for the production failure where every field on a place
// became unsaveable with:
//
//   "Erro ao guardar. nowTimeWindows.4: Invalid enum value.
//    Expected 'morning' | 'midday' | 'afternoon' | 'evening' | 'night',
//    received 'late_evening'"
//
// The component loads `nowTimeWindows` from the API into form state and
// submits it back on every save. It only rendered five buttons, and none of
// them was `late_evening` or `deep_night` — the two values the seed scripts
// had written for 58 of the 387 places. The offending value was therefore
// invisible in the UI and impossible to deselect, so the editor could not
// touch the place's text, hours or category either.
//
// The button list now matches the engine's six windows. `sanitizeTimeWindows`
// is the second line of defence: whatever the API returns, the form must
// never hold a value it cannot render.
//
// Note: this file uses vitest; the dashboard does not currently have a test
// runner installed. The tests are written to run unmodified once vitest is
// added to devDependencies — they import only pure functions.

import { describe, it, expect } from "vitest";
import { sanitizeTimeWindows } from "../PlaceNowVisibility";

describe("sanitizeTimeWindows", () => {
  it("keeps the six canonical windows, in order", () => {
    const input = ["morning", "midday", "afternoon", "evening", "late_evening", "deep_night"];
    expect(sanitizeTimeWindows(input)).toEqual({ windows: input, dropped: [] });
  });

  it("keeps late_evening at index 4 — the exact reported payload", () => {
    // Previously this value had no button, so it survived in form state,
    // went back to the API on save, and was rejected at index 4.
    const { windows, dropped } = sanitizeTimeWindows([
      "morning", "midday", "afternoon", "evening", "late_evening", "deep_night",
    ]);
    expect(windows[4]).toBe("late_evening");
    expect(dropped).toEqual([]);
  });

  it("maps the legacy 'night' value onto late_evening", () => {
    // 'night' was this component's old label for 22:00-06:00. The engine
    // never emits it, so a place stored with it dropped out of NOW overnight.
    expect(sanitizeTimeWindows(["night"])).toEqual({
      windows: ["late_evening"],
      dropped: [],
    });
  });

  it("does not duplicate when both 'night' and late_evening are present", () => {
    expect(sanitizeTimeWindows(["late_evening", "night"]).windows).toEqual(["late_evening"]);
  });

  it("drops an unrenderable value and reports it to the editor", () => {
    // Reporting matters: silently dropping a window would quietly change the
    // place's NOW eligibility on the next save with no one noticing.
    expect(sanitizeTimeWindows(["morning", "teatime"])).toEqual({
      windows: ["morning"],
      dropped: ["teatime"],
    });
  });

  it("reports each unknown value once", () => {
    expect(sanitizeTimeWindows(["teatime", "teatime"]).dropped).toEqual(["teatime"]);
  });

  it("leaves an empty selection empty — it means 'relevant at all hours'", () => {
    expect(sanitizeTimeWindows([])).toEqual({ windows: [], dropped: [] });
  });
});
