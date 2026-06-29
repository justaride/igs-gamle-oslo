# User Registration Hardening Design

## Goal

Make user-entered data durable and traceable for the next project phase by fixing manual species registration, adding audit/source fields for new species observations, and adding IGS to the production database backup routine.

## Scope

This design covers three concrete gaps found during the production audit:

- Manual area edits and status changes already work and are audited.
- New site creation code exists, but production has no evidence that it has been used.
- Manual species registration is unsafe because the UI posts `latitude: 0` and `longitude: 0`, and species rows do not record source or editor identity.
- The production host has a general backup script, but it does not include the IGS Postgres container.

## Approach

Use the selected site's polygon centroid as the default point for a manual species observation. This keeps the UI simple and avoids inventing a point-picking interaction before the project needs one. The backend will validate the incoming species payload with the same parser style used by site updates, then store `source`, `created_by`, and `created_at` for new rows.

Existing imported species rows remain valid and are marked as imported by migration defaults. The UI can continue listing species exactly as before, with optional metadata available for future admin/status views.

Backups are handled outside the app code by adding the IGS database container to the server's existing `/root/backup-databases.sh` job and verifying a real dump can be produced. This does not modify production application data.

## Data Model

Add to `species_observations`:

- `source TEXT NOT NULL DEFAULT 'imported'`
- `created_by TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- check constraint for `source IN ('imported', 'manual')`

For UI-created observations, write `source='manual'` and `created_by` from `x-editor-name`.

## Validation

The server should reject species writes when:

- `site_id` is not a positive integer.
- `scientific_name` is empty.
- `observation_count` is not a positive integer.
- longitude/latitude are missing, non-finite, or out of valid WGS84 bounds.

## Testing

Add parser smoke tests for valid manual species payloads and each rejected edge case. Build server and client from a non-iCloud temporary copy if TypeScript hangs in the workspace path. Verify production read endpoints and a non-mutating invalid species POST after changes.

## Non-Goals

- No point-picking map UI for species observations yet.
- No retroactive reconstruction of exact creation times for imported species rows.
- No production test insert unless explicitly approved later.
