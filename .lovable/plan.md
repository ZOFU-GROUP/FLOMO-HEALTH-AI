## Goal
Turn Flomo Health AI into an installable PWA, switch a few tracking inputs from manual to sensor-based / friendlier units, and tighten the chronic-disease loop so the meal plan truly reacts to the user's conditions.

## 1. PWA (installable, works on all devices)
- Add `public/manifest.webmanifest` with name "Flomo Health AI", short name "Flomo", `display: "standalone"`, theme/background from the Warm Wellness palette, and icons (generate 192/512 maskable PNGs from the existing logo).
- Add `<link rel="manifest">`, `theme-color`, and `apple-touch-icon` head tags in `src/routes/__root.tsx`.
- No offline service worker (user asked for installability + responsive viewing, not offline). The existing responsive layout already covers "easy to view on all devices"; I'll do a quick mobile pass on Tracking + Meals.

## 2. Automatic step tracking (sensor-based)
- New `useStepCounter` hook using the browser's `DeviceMotion` / `Accelerometer` (Generic Sensor API) where available, with a simple peak-detection algorithm for step counts. Falls back gracefully when sensors aren't granted (shows a "Sensors unavailable" badge instead of a number input).
- On the Tracking page, replace the manual Steps input with a live step counter card (Start/Stop, current count, auto-saves to today's `health_logs.steps` every ~30s and on stop).
- iOS requires a tap to request motion permission — the Start button triggers `DeviceMotionEvent.requestPermission()`.

## 3. Water in cups, not ml
- Tracking: replace "Water (ml)" number input with a cup tracker (− / count / +, each cup = 240 ml). We continue to store ml in `health_logs.water_ml` so the schema stays the same; UI just multiplies/divides by 240.
- Dashboard: render water as cups.

## 4. Chronic disease as a first-class flow
- Tracking page gets a new "Conditions" section above Medications:
  - Lists current `profiles.chronic_conditions` as chips with edit / remove.
  - "Add condition" input with common suggestions (Diabetes, Hypertension, PCOS, Thyroid, High Cholesterol, IBS, Asthma, CKD, Heart disease).
  - Saves directly to `profiles.chronic_conditions` (array).
- After any change, invalidate the meal-plan queries; user sees a toast "Conditions updated — regenerate meal plan to refresh suggestions."
- Strengthen the AI system prompt in `kimi.server.ts` so condition-specific guidance is explicit (e.g. low-GI for diabetes, low-sodium for hypertension, etc.) and the meal plan returns a `condition_notes` field per meal explaining why it suits the user's conditions.
- Meals page: render each meal's `condition_notes` as a small "Why this works for you" line.

## 5. Smarter grocery hand-off
- Meal plan JSON adds `necessary: boolean` per grocery item (AI marks pantry staples user likely already has as `false`).
- Grocery panel in Meals shows only `necessary: true` by default with a "Show all" toggle; "Add all" only pushes necessary items unless toggled.

## 6. Verification
- `tsgo` typecheck.
- Quick Playwright pass: install prompt manifest is served, Tracking shows step counter + cup tracker + conditions editor, Meals shows condition notes.

## Files touched
- New: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `src/hooks/use-step-counter.ts`, `src/components/conditions-editor.tsx`
- Edit: `src/routes/__root.tsx`, `src/routes/_authenticated/tracking.tsx`, `src/routes/_authenticated/meals.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/lib/kimi.server.ts`, `src/lib/meals.functions.ts`

No DB migration needed — all changes fit existing columns (`chronic_conditions` array, `water_ml`, `steps`, `plan` jsonb).
