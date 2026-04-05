# Goldenbook Recommendation System — QA Checklist

## 1. Editor Workflow (Dashboard Super Admin)

### Add context tags
- [ ] Open a place in the dashboard (e.g. a Porto restaurant)
- [ ] Go to "Contextual Relevance" section
- [ ] Add tags: **Terrace**, **Wine**, **Romantic**
- [ ] Save
- [ ] Open the app → Porto → check "Qué debería hacer ahora"
- [ ] Verify the place appears or ranks higher than before
- [ ] Open Concierge → tap a related intent (e.g. "Sunset drinks")
- [ ] Verify the place appears in results

### Remove context tags
- [ ] Remove all tags from the same place in the dashboard
- [ ] Save
- [ ] Reload NOW in the app
- [ ] Verify the place no longer appears in NOW (it has no tags)
- [ ] Verify Concierge still shows other relevant results

### Time window test
- [ ] Add time windows (e.g. "evening" only) to a place
- [ ] Verify the place ranks higher in the evening
- [ ] Verify it still appears at other times (lower ranked, not hidden)

---

## 2. Business Workflow (Business Dashboard)

### Purchase NOW slot
- [ ] Create a NOW visibility campaign for a Porto place
- [ ] Set: surface=now, dates=today→tomorrow, priority=high
- [ ] Open the app → Porto → "Qué debería hacer ahora"
- [ ] Verify the place appears in **Top 1** with sponsored indicator
- [ ] Switch to Lisboa → verify the Porto campaign does **NOT** appear

### Purchase Concierge slot
- [ ] Create a Concierge visibility campaign for the same or different place
- [ ] Set: surface=concierge, dates=today→tomorrow
- [ ] Open Concierge from Porto
- [ ] Tap any intent card
- [ ] Verify the paid place appears in the **Top 3** results
- [ ] If it doesn't match the intent, verify it appears at the **bottom** of results (not top)

### Pause campaign
- [ ] Set `is_active = false` on the campaign (or delete it)
- [ ] Reload NOW / Concierge in the app
- [ ] Verify the place is **no longer boosted**
- [ ] Verify organic results return to normal

### Cross-city isolation
- [ ] Create a campaign for a Lisboa place
- [ ] Check Porto NOW and Concierge
- [ ] Verify the Lisboa place does **NOT** appear in Porto results

---

## 3. App Behavior

### NOW — Time of day
- [ ] **Morning** (~9:00): verify Coffee, Brunch, Quick Stop tags rank high
- [ ] **Midday** (~12:30): verify Brunch, Quick Stop rank high
- [ ] **Afternoon** (~15:00): verify Shopping, Culture, Coffee rank high
- [ ] **Evening** (~19:30): verify Dinner, Cocktails, Sunset, Romantic rank high
- [ ] **Night** (~23:00): verify Late Night, Cocktails, Live Music rank high
- [ ] At no time should Brunch appear at night or Late Night in the morning

### NOW — Weather
- [ ] **Sunny**: verify Terrace, Rooftop, Sunset, Viewpoint rank higher
- [ ] **Rainy**: verify Rainy Day, Coffee, Culture, Shopping rank higher
- [ ] Verify a "Rainy Day" tagged place is **NOT eliminated** on sunny days (just lower)
- [ ] Verify a "Terrace" tagged place is **NOT eliminated** on rainy days (just lower)

### NOW — 3-option cycle
- [ ] Tap "Reintentar" / "Ver otra opción" repeatedly
- [ ] Verify exactly **3 different places** appear then **loop** (A→B→C→A→B→C)
- [ ] Verify it never shows a 4th unique place

### Concierge — Context-aware bootstrap
- [ ] Open Concierge at **19:30 sunny**
- [ ] Verify intent cards show dinner/cocktails/sunset themes (not brunch/coffee)
- [ ] Open Concierge at **9:00 morning**
- [ ] Verify intent cards show coffee/brunch/culture themes (not late night)

### Concierge — Refinements
- [ ] Open Concierge, get initial recommendations
- [ ] Type **"algo más relajado"** or **"something more relaxed"**
- [ ] Verify results shift toward Wine, Terrace, Romantic
- [ ] Verify results shift away from Live Music, Celebration, Late Night
- [ ] Verify the change is **additive** (context-aware, not a random reset)
- [ ] Try **"más romántico"** → verify Romantic, Fine Dining, Wine boost
- [ ] Try **"algo cultural"** → verify Culture, Local Secret, Viewpoint boost

### Concierge — City consistency
- [ ] Select Porto in Discover
- [ ] Open Concierge
- [ ] Verify greeting says Porto (not Lisboa)
- [ ] Verify all recommendations are Porto places
- [ ] Navigate to Discover → switch to Lisboa → open Concierge
- [ ] Verify greeting now says Lisboa with Lisboa places

---

## Quick Smoke Test (5 minutes)

For daily verification:

1. [ ] Open app → Porto → NOW shows a recommendation (not empty)
2. [ ] Tap "Reintentar" 3x → cycles correctly (3 places, then loops)
3. [ ] Open Concierge → intent cards match time of day
4. [ ] Tap an intent → get 3+ relevant results
5. [ ] Type "más relajado" → results shift (not reset)
6. [ ] Switch to Lisboa → NOW shows Lisboa places (not Porto)
