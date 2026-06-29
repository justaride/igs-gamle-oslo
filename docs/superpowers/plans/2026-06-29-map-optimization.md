# Map Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for code changes and superpowers:verification-before-completion before claiming completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the IGS map on desktop and mobile by fixing mobile layout, lazy-loading species, reducing map rendering overhead, and tightening accessibility.

**Architecture:** Keep existing page/component boundaries. Add a map-page shell class in `App.tsx`, mobile scoped CSS in `app.css`, a lazy `useSpecies(enabled)` hook, and an imperative canvas-backed `SpeciesLayer` inside `Map.tsx`.

**Tech Stack:** React 18, React Query, Zustand, Leaflet, React Leaflet, TypeScript, Vite.

---

### Task 1: Source-Level Regression Smoke

**Files:**
- Create: `client/scripts/smoke-test-map-optimization.mjs`
- Modify: `client/package.json`

- [ ] Add smoke checks for lazy species loading, non-SVG species rendering, scoped mobile map shell CSS, collapsible mobile controls, and named review queue checkboxes.
- [ ] Run `npm run smoke:map` in `client/` and confirm it fails against current code.

### Task 2: Mobile Map Layout

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/app.css`

- [ ] Add route-scoped shell classes for `/map`.
- [ ] On small screens, make the dashboard topbar non-sticky and compact for map pages.
- [ ] Keep the map page body usable with a stable map height and a bounded review/sidebar area.

### Task 3: Map Controls

**Files:**
- Modify: `client/src/components/Map.tsx`
- Modify: `client/src/app.css`

- [ ] Add a compact mobile control cluster that lets users open/close layer and legend panels.
- [ ] Keep desktop controls visible as they are today.

### Task 4: Species Loading And Rendering

**Files:**
- Modify: `client/src/hooks/useSpecies.ts`
- Modify: `client/src/components/Map.tsx`

- [ ] Make `useSpecies` accept an `enabled` flag.
- [ ] Only fetch `/api/species` when the species layer is enabled.
- [ ] Render species through an imperative Leaflet canvas layer rather than thousands of React `CircleMarker` components.

### Task 5: Accessibility And Verification

**Files:**
- Modify: `client/src/components/ReviewQueuePanel.tsx`

- [ ] Add accessible labels to review queue checkboxes.
- [ ] Run `npm run smoke:map`, `npm run build`, and browser QA for desktop/mobile.
