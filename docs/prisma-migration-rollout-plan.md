# Prisma Migration Rollout Plan

## Goal

Move Wanderly from the current small relational footprint:

- `User`
- `Trip`
- `SelectedPlace`

to the new production Prisma schema in a safe, staged, additive-first way.

This plan avoids a risky all-at-once migration and is designed to:

- preserve auth compatibility
- preserve existing `User`, `Trip`, and `SelectedPlace` data
- avoid destructive renames or drops early
- allow phased application rollout behind feature flags
- support rollback by disabling new features instead of trying to undo large schema changes

## Current Known Baseline

Existing database objects already in migration history:

- `User`
  - `id`
  - `name`
  - `email`
  - `passwordHash`
  - `createdAt`
  - `updatedAt`
- `Trip`
  - `id`
  - `userId`
  - `isActive`
  - `origin`
  - `startDate`
  - `endDate`
  - `travelers`
  - `budgetType`
  - `budgetAmount`
  - `pace`
  - `createdAt`
  - `updatedAt`
- `SelectedPlace`
  - `id`
  - `tripId`
  - `placeId`
  - `name`
  - `image`
  - `lat`
  - `lon`
  - `distance`
  - `travelTime`
  - `createdAt`

## High-Risk Areas

These should not be changed in one shot:

1. `User.passwordHash`
   Keep it as the auth source of truth until the application is explicitly updated.

2. `Trip.budgetAmount`
   Existing DB type is `DOUBLE PRECISION`. The new Prisma schema models it as `Decimal`.
   This is a type-conversion risk and should not be altered in the first rollout.

3. `SelectedPlace`
   Existing data should be preserved as-is. Do not replace it immediately with `TripDestination`.

4. Duplicate or overlapping profile/auth fields
   - `User.name` vs `UserProfile.displayName`
   - `User.passwordHash` vs `UserCredential.passwordHash`
   These need a compatibility period.

## Guiding Rules

- Prefer additive migrations first.
- New columns on existing tables should be nullable first unless the default is safe and well understood.
- Do not drop or rename legacy columns in early phases.
- Do not backfill inferred travel structure unless the source data is good enough.
- Keep new application features behind feature flags until the corresponding migration is complete and validated.
- Every phase should be deployable independently.

## Safe Tables To Create First

These are safe because they are new, append-only, or do not mutate existing production behavior:

- `UserProfile`
- `AuthIdentity`
- `UserSession`
- `AuthEvent`
- `FailedLoginCounter`
- `UserTravelPreference`
- `UserPreferenceTag`
- `NotificationPreference`
- `AiProfile`
- `AiProfileFact`
- `Destination`
- `DestinationTag`
- `SavedDestination`
- `DestinationCollection`
- `DestinationCollectionItem`
- `WeatherQuery`
- `WeatherCache`
- `DestinationInsightCache`
- `AiResponseCache`
- `Notification`
- `NotificationDelivery`
- `EmailMessage`
- `Reminder`
- `ActivityEvent`
- `AuditLog`
- `SupportTicket`
- `SupportMessage`
- `UserFeedback`
- `AdminNote`

These can be introduced without changing legacy auth, trip planning, or existing reads.

## Existing Tables That Must Be Altered Carefully

### `User`

Safe additive columns:

- `avatarUrl`
- `phone`
- `accountStatus`
- `emailVerifiedAt`
- `lastActiveAt`
- `deletedAt`

Compatibility note:

- Keep `name`, `email`, and `passwordHash` exactly intact for now.
- `User.name` remains the UI/auth-facing display field until profile rollout is complete.

### `Trip`

Safe additive columns:

- `title`
- `status`
- `originAirportCode`
- `travelStyle`
- `notes`
- `createdFrom`
- `deletedAt`

Risky field:

- `budgetAmount`
  - current type: floating-point
  - target type: decimal
  - migrate later with a temporary compatibility strategy

### `SelectedPlace`

Do not alter early.

Keep it as the legacy saved-trip-place source while `TripDestination` is introduced separately for new functionality.

## Nullable-First Strategy

For existing tables, introduce new columns as nullable or with safe defaults:

- `User.avatarUrl`: nullable
- `User.phone`: nullable
- `User.emailVerifiedAt`: nullable
- `User.lastActiveAt`: nullable
- `User.deletedAt`: nullable
- `Trip.title`: nullable
- `Trip.originAirportCode`: nullable
- `Trip.travelStyle`: nullable
- `Trip.notes`: nullable
- `Trip.createdFrom`: nullable with app default if desired
- `Trip.deletedAt`: nullable

For new tables:

- foreign keys may be nullable when linking to optional future entities
- avoid `NOT NULL` on fields that depend on a backfill unless you have already backfilled the data

## Temporary Compatibility Fields / Transitional Approach

### `UserCredential`

Recommendation:

- create the table, but do not switch auth reads to it yet
- keep `User.passwordHash` as canonical in phase 1
- if a future refactor wants `UserCredential` as canonical, do a dual-write period first

### `UserProfile.displayName`

Recommendation:

- backfill from `User.name`
- keep the app reading `User.name` until profile UI is migrated
- dual-read later if needed

### `Trip.budgetAmount`

Recommendation:

- do not convert the existing column immediately
- either:
  - keep the current DB column as float until the app is ready, or
  - add a temporary `budgetAmountDecimal` column via a manual SQL migration and dual-write during transition

Because the current Prisma target schema already expects decimal, the safest rollout is:

1. temporarily keep a migration branch where DB remains compatible with the current float column
2. later perform an explicit float-to-decimal migration with backfill and code changes in the same phase

### `SelectedPlace` and `TripDestination`

Recommendation:

- keep `SelectedPlace` as the preserved legacy structure
- introduce `TripDestination` separately
- only backfill `TripDestination` where route order can be inferred safely
- otherwise leave legacy trips on `SelectedPlace` and use `TripDestination` for newly created trips

## Backfill Strategy

### Required Backfills

1. `UserProfile`
   - `userId = User.id`
   - `displayName = User.name`
   - `profileCompletionPct = 0` or computed light heuristic

2. `UserTravelPreference`
   Optional bulk creation. Prefer lazy creation on first use to avoid unnecessary rows.

3. `NotificationPreference`
   Optional bulk creation. Safe to lazily create on first preference save or first notification send.

4. `AiProfile`
   Prefer lazy creation on first AI use.

5. `Trip`
   Backfill additive fields:
   - `status = ACTIVE` where `isActive = true`
   - `status = ARCHIVED` where `isActive = false`
   - `title = COALESCE(origin || ' trip', 'Untitled trip')`
   - `createdFrom = 'manual'`

6. `TripDestination`
   Backfill only if route order can be safely derived.
   Recommended conservative rule:
   - order by `SelectedPlace.createdAt`
   - create one `TripDestination` row per distinct place if duplication is low and clearly intentional
   If data quality is uncertain, skip bulk backfill and keep `SelectedPlace` as the legacy source.

### Backfills That Should Wait

- `UserCredential` from `User.passwordHash`
  Only do this if and when the auth code is updated for dual-write.

- decimal conversion for `Trip.budgetAmount`
  This needs its own isolated data migration and validation pass.

## Recommended Rollout Order

### Phase 0: Preflight and Baseline Verification

Migration file:

- `20260405_0000_preflight_baseline_check`

Purpose:

- no destructive schema change
- verify actual DB matches expected baseline
- confirm `_prisma_migrations` state
- run `prisma migrate status`
- inspect production/staging drift before applying new migrations

Manual checks:

- row counts for `User`, `Trip`, `SelectedPlace`
- sample records
- backup snapshot

### Phase 1: Extend Core Tables Safely

Migration file:

- `20260405_0001_extend_user_and_trip_nullable`

Scope:

- add nullable/safe-default columns to `User`
- add nullable/safe-default columns to `Trip`
- do not alter `SelectedPlace`
- do not convert `Trip.budgetAmount`

Why first:

- minimal risk
- gives the application room to start writing richer fields

### Phase 2: Auth Audit and Profile Foundations

Migration file:

- `20260405_0002_auth_profile_foundations`

Scope:

- create `UserProfile`
- create `AuthIdentity`
- create `UserSession`
- create `AuthEvent`
- create `FailedLoginCounter`
- create `UserTravelPreference`
- create `UserPreferenceTag`
- create `NotificationPreference`
- create `AiProfile`
- create `AiProfileFact`

Backfill after migration:

- `UserProfile` from existing `User`

### Phase 3: Destination and Cache Foundations

Migration file:

- `20260405_0003_destinations_and_cache_foundation`

Scope:

- create `Destination`
- create `DestinationTag`
- create `SavedDestination`
- create `DestinationCollection`
- create `DestinationCollectionItem`
- create `WeatherQuery`
- create `WeatherCache`
- create `DestinationInsightCache`
- create `AiResponseCache`

Why here:

- no impact on auth or legacy trip data
- prepares reference tables for later trip and AI features

### Phase 4: Conversation and AI Core

Migration file:

- `20260405_0004_conversation_ai_core`

Scope:

- create `Conversation`
- create `ConversationContextSnapshot`
- create `Message`
- create `MessageArtifact`
- create `MessageAction`
- create `AiRun`
- create `AiToolCall`
- create `ConversationEvent`

Compatibility:

- all new
- no impact on current auth flow

### Phase 5: Trip Planning V2 Without Replacing Legacy Data

Migration file:

- `20260405_0005_trip_planning_v2`

Scope:

- create `TripDestination`
- create `TripPreference`
- create `TripIdea`
- create `TripRevision`
- create `TripConversationLink`

Important:

- keep `SelectedPlace`
- do not drop or rename `SelectedPlace`
- new trip-planning code can start using `TripDestination` for fresh trips only

Backfill:

- conservative `Trip` title/status/createdFrom` backfill
- optional `TripDestination` backfill from `SelectedPlace` only if data quality is acceptable

### Phase 6: Budgeting

Migration file:

- `20260405_0006_budgeting_core`

Scope:

- create `BudgetPlan`
- create `BudgetLineItem`
- create `BudgetEstimateRun`
- create `BudgetAlert`

Important:

- do not convert `Trip.budgetAmount` yet
- leave legacy trip budget fields intact

### Phase 7: Billing and Subscription Foundation

Migration file:

- `20260405_0007_billing_foundation`

Scope:

- create `BillingProfile`
- create `BillingAddress`
- create `PaymentMethod`
- create `Subscription`
- create `Invoice`
- create `InvoiceLineItem`
- create `PaymentTransaction`
- create `Refund`
- create `UsageCredit`
- create `UsageMeterEvent`

Why isolated:

- billing should be independently deployable and auditable
- easier rollback by feature flag if something is wrong

### Phase 8: Booking Foundation

Migration file:

- `20260405_0008_booking_foundation`

Scope:

- create `Booking`
- create `BookingItem`
- create `FlightBooking`
- create `HotelBooking`
- create `ActivityBooking`
- create `BookingStatusHistory`

### Phase 9: Notification, Support, and Audit Operations

Migration file:

- `20260405_0009_ops_notifications_support`

Scope:

- create `Notification`
- create `NotificationDelivery`
- create `EmailMessage`
- create `Reminder`
- create `ActivityEvent`
- create `AuditLog`
- create `SupportTicket`
- create `SupportMessage`
- create `UserFeedback`
- create `AdminNote`

### Phase 10: Data Hardening and Constraint Tightening

Migration file:

- `20260405_0010_backfill_and_hardening`

Scope:

- tighten nullability only after data is backfilled and code is writing correctly
- add any additional unique constraints only after duplicate checks
- add indexes that depend on proven query patterns if needed

This is also the right phase for:

- deciding whether to enforce more `NOT NULL` constraints
- deciding whether to begin deprecating legacy usage patterns

### Phase 11: Legacy Convergence

Migration file:

- `20260405_0011_legacy_convergence_optional`

Scope:

- only after the app fully migrates
- consider:
  - deprecating `SelectedPlace` in favor of `TripDestination`
  - deprecating `User.passwordHash` in favor of `UserCredential`
  - converting `Trip.budgetAmount` float to decimal

This phase should happen only after a stable production soak period.

## Breaking-Change Watchlist

These changes can break production if rushed:

1. Changing auth reads from `User.passwordHash` to `UserCredential.passwordHash`
2. Converting `Trip.budgetAmount` from float to decimal without dual-read/validation
3. Replacing `SelectedPlace` reads with `TripDestination` before backfill logic is proven
4. Enforcing `NOT NULL` on newly added columns before backfill is complete
5. Adding strict foreign keys to data that has not been cleaned or mapped

## Prisma Migration Split Recommendation

Use separate migration files for these exact groups:

1. `0001_extend_user_and_trip_nullable`
2. `0002_auth_profile_foundations`
3. `0003_destinations_and_cache_foundation`
4. `0004_conversation_ai_core`
5. `0005_trip_planning_v2`
6. `0006_budgeting_core`
7. `0007_billing_foundation`
8. `0008_booking_foundation`
9. `0009_ops_notifications_support`
10. `0010_backfill_and_hardening`
11. `0011_legacy_convergence_optional`

This keeps each deploy understandable and rollback-friendly.

## Rollback and Safety Plan

### Before Every Phase

- take a database snapshot/backup
- record row counts for touched tables
- apply first in staging
- run smoke tests against auth, trip planning, and existing pages
- deploy schema before code when possible for additive changes

### Rollback Philosophy

For additive phases, prefer:

- rolling back application usage of new tables
- disabling features behind flags
- leaving new tables in place if they are harmless and empty or append-only

Do not rely on destructive down-migrations in production unless absolutely necessary.

### Specific Safety Measures

- `Conversation` and AI features:
  deploy with feature flag, then enable per environment

- Billing tables:
  keep isolated from existing payment flows until tested

- Booking tables:
  start with write-disabled or admin-only flows in staging

- Trip V2:
  dual-read old and new structures before switching fully

## Seed / Update Strategy for Existing Data

### Seed Style

Use idempotent backfill scripts, not one-off manual edits.

Recommended pattern:

- `scripts/backfill-user-profiles.ts`
- `scripts/backfill-trip-metadata.ts`
- `scripts/backfill-trip-destinations.ts`

Each script should:

- be rerunnable safely
- check whether a record already exists before insert
- log counts for created, skipped, and errored rows

### Existing User Data

- preserve all existing `User` rows
- backfill `UserProfile` with `displayName = User.name`
- do not touch `passwordHash`

### Existing Trip Data

- preserve all existing `Trip` rows
- add `status`, `title`, and `createdFrom` via safe updates
- do not change `budgetAmount` type in the same rollout

### Existing Selected Place Data

- preserve all existing `SelectedPlace` rows
- only copy into `TripDestination` if ordering and deduping rules are acceptable
- otherwise support both legacy and new structures during transition

## Recommended Execution Order

Run in this order:

1. baseline verification
2. extend existing tables safely
3. auth/profile foundations
4. destination/cache foundations
5. conversation/AI core
6. trip planning V2
7. budgeting
8. billing
9. bookings
10. notifications/support/audit
11. backfill and hardening
12. optional legacy convergence much later

## Practical Next Step

Before generating actual Prisma migration SQL, update the target rollout so that the first few migrations do not force the risky `Trip.budgetAmount` type change. That part should be isolated into a later compatibility migration instead of being bundled with the first schema rollout.
