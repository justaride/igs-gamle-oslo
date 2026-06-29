# Map Optimization Design

## Goal

Make the IGS map feel like the primary working surface on desktop and mobile, while reducing unnecessary data loading and rendering cost.

## Scope

This slice addresses the issues found in the live map audit:

- Mobile `/map` should show the operational map surface without the global topbar covering the viewport.
- Species data should not load until the user enables the species layer.
- Species rendering should avoid one React/SVG element per observation.
- Mobile map overlays should be compact and collapsible.
- Review queue checkboxes should have accessible names.

The slice does not replace Leaflet, change backend data shape, or redesign the whole dashboard navigation.

## Approach

Use the existing React, Zustand, React Query, and Leaflet stack. Keep the desktop layout familiar, but add a map-page shell class so mobile-specific behavior can be scoped to `/map`. Move species rendering into an imperative Leaflet layer that uses a canvas renderer and only mounts when the species layer is enabled.

## Verification

Add a client smoke script that checks the source-level invariants for this map optimization. Then verify with client build and browser screenshots on desktop and mobile.
