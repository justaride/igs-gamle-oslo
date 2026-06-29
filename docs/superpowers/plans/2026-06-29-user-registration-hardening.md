# User Registration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix manual species registration, make new species rows auditable, and add IGS to production database backups.

**Architecture:** Keep the frontend simple by deriving a species observation point from the selected site's polygon centroid. Move species payload validation into `server/src/validation.ts`, store source/editor metadata in Postgres, and use the existing server backup script for operational protection.

**Tech Stack:** React, React Query, Express, TypeScript, Postgres/PostGIS, Docker, Coolify-hosted production.

---

### Task 1: Add Species Payload Validation

**Files:**
- Modify: `server/src/validation.ts`
- Modify: `server/scripts/smoke-test-validation.mjs`

- [ ] Add `parseSpeciesCreateBody` that returns `siteId`, `scientificName`, `vernacularName`, `observationCount`, `latitude`, and `longitude`.
- [ ] Extend the validation smoke script with valid species payload, missing scientific name, invalid count, invalid latitude, and invalid longitude checks.
- [ ] Run server build plus validation smoke and verify the new tests fail before implementation and pass after implementation.

### Task 2: Store Species Audit Metadata

**Files:**
- Create: `server/migrations/008_species_observation_audit.sql`
- Modify: `server/src/services/speciesService.ts`
- Modify: `server/src/routes/species.ts`
- Modify: `server/src/types.ts`
- Modify: `client/src/types.ts`

- [ ] Add `source`, `created_by`, and `created_at` columns with a source check constraint.
- [ ] Use `extractEditorName(req)` in `POST /api/species`.
- [ ] Pass `source='manual'` and `createdBy` into `createObservation`.
- [ ] Return audit metadata in species list and site-specific species responses.

### Task 3: Fix Frontend Species Coordinates

**Files:**
- Modify: `client/src/components/SiteSidebar.tsx`
- Modify: `client/src/components/SpeciesPanel.tsx`

- [ ] Pass the selected site geometry into `SpeciesPanel`.
- [ ] Compute a stable fallback point from the selected polygon or multipolygon before posting.
- [ ] Send that point as `longitude` and `latitude` instead of `0,0`.
- [ ] Keep the current form shape and success/error toasts.

### Task 4: Verify Locally

**Files:**
- No source changes expected.

- [ ] Run server build and smoke tests from a `/tmp` copy if the iCloud workspace path hangs.
- [ ] Run client build from a `/tmp` copy if needed.
- [ ] Confirm `git status --short` shows only intentional source/docs changes.

### Task 5: Add Production Backup Coverage

**Files:**
- Production host: `/root/backup-databases.sh`

- [ ] Back up the current script before editing.
- [ ] Add an `igs` entry for container `db-rkkogwgg0kw4o08skccocgso-085714643965`, user `igs`, database `igs`.
- [ ] Run one manual backup script execution and confirm an `igs-*.dump.gz` appears in `/opt/db-backups/daily`.
- [ ] Do not restore or mutate application data.

### Task 6: Runtime Verification

**Files:**
- No source changes expected.

- [ ] Confirm `/api/health`, `/api/sites`, `/api/species`, `/api/sites/review-queue?limit=10`, and exports still return 200.
- [ ] Confirm invalid species write requests still return 400 and do not create rows.
- [ ] Confirm production DB has no `(0,0)` species rows after deployment unless a real user created one before deploy.
