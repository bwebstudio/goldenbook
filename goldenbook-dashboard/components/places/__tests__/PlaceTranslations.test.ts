// ─── PlaceTranslations: PT-source dirty-state helper ───────────────────────
//
// The "Regenerate translations from Portuguese" button on PlaceTranslations
// switches between disabled / enabled based on whether any of the five
// Portuguese source fields have changed since the last sync (component
// mount or successful regeneration). The decision lives in
// `arePtSourceFieldsDirty` so it can be unit-tested in isolation and so the
// dashboard's notion of "PT changed" stays in lock-step with the backend's
// `PT_SOURCE_FIELDS` list (see translation-policy.ts on the API side).
//
// Note: this file uses vitest; the dashboard does not currently have a test
// runner installed. The tests are written to run unmodified once vitest is
// added to devDependencies — they import only pure functions.

import { describe, it, expect } from "vitest";
import { arePtSourceFieldsDirty, type PtSourceFields } from "../PlaceTranslations";

const baseline: PtSourceFields = {
  name: "Pastéis de Belém",
  shortDescription: "Pastelaria icónica",
  fullDescription: "Descrição completa do estabelecimento.",
  goldenbookNote: "Nota editorial Goldenbook.",
  insiderTip: "Vai cedo de manhã.",
};

describe("arePtSourceFieldsDirty", () => {
  it("returns false on initial load (snapshot equals current)", () => {
    // The component takes its snapshot from the same source it renders
    // from on first render — the regenerate button must start disabled.
    expect(arePtSourceFieldsDirty(baseline, baseline)).toBe(false);
  });

  it("returns true when the editor types in `name`", () => {
    expect(arePtSourceFieldsDirty(baseline, { ...baseline, name: "Pastéis de Belém — fechado" })).toBe(true);
  });

  it("returns true when the editor types in `shortDescription`", () => {
    expect(arePtSourceFieldsDirty(baseline, { ...baseline, shortDescription: "edited" })).toBe(true);
  });

  it("returns true when the editor types in `fullDescription`", () => {
    expect(arePtSourceFieldsDirty(baseline, { ...baseline, fullDescription: "edited" })).toBe(true);
  });

  it("returns true when the editor types in `goldenbookNote`", () => {
    expect(arePtSourceFieldsDirty(baseline, { ...baseline, goldenbookNote: "edited" })).toBe(true);
  });

  it("returns true when the editor types in `insiderTip`", () => {
    expect(arePtSourceFieldsDirty(baseline, { ...baseline, insiderTip: "edited" })).toBe(true);
  });

  it("returns false again after the editor reverts the change", () => {
    // Edit, then undo — the button should disable again. This proves the
    // decision is a pure equality check, not a one-way "ever dirty" flag.
    const edited = { ...baseline, name: "edited" };
    expect(arePtSourceFieldsDirty(baseline, edited)).toBe(true);
    expect(arePtSourceFieldsDirty(baseline, { ...edited, name: baseline.name })).toBe(false);
  });

  it("ignores whitespace differences only when the editor actually pastes them", () => {
    // We deliberately do NOT trim before comparing. If an editor pastes a
    // trailing space they want to be able to regenerate, save it as-is and
    // see it propagate. This test pins that behavior so a future refactor
    // doesn't quietly change it.
    expect(arePtSourceFieldsDirty(baseline, { ...baseline, name: baseline.name + " " })).toBe(true);
  });
});
