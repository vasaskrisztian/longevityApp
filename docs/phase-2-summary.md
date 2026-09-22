# Phase 2 — Profiles

## Implemented

- `onboardingCompletedAt DateTime?` added to `User` (prisma/schema.prisma) —
  set once, at the end of the wizard, and read by `requireOnboardedUserForPage()`.
- Validation schemas (Zod, server-side source of truth):
  `lib/validation/onboarding.schemas.ts` (`PersonalInfoSchema`,
  `ExerciseProfileSchema`, `NutritionProfileSchema`,
  `CompleteOnboardingSchema`), `lib/validation/supplement.schemas.ts`
  (`CreateSupplementSchema`, `UpdateSupplementSchema`),
  `lib/validation/goal.schemas.ts` (`CreateGoalSchema`, `UpdateGoalSchema`).
- Service layer: `modules/profile/profile.service.ts` (`getProfileBundle`,
  `isOnboardingComplete`, `updatePersonalInfo`, `upsertExerciseProfile`,
  `upsertNutritionProfile`, `completeOnboarding` — the last one a single
  `$transaction` covering Profile + ExerciseProfile + NutritionProfile +
  `onboardingCompletedAt`), `modules/supplements/supplements.service.ts` and
  `modules/goals/goals.service.ts` (list/get/create/update/delete each).
- API routes, every one gated by the central authorization helpers before
  touching Prisma: `POST /api/onboarding`, `GET`/`PATCH /api/profile`,
  `PATCH /api/profile/exercise`, `PATCH /api/profile/nutrition`, full CRUD
  `/api/supplements` + `/api/supplements/[id]`, full CRUD `/api/goals` +
  `/api/goals/[id]`. The `[id]` routes re-verify ownership
  (`requireOwnResourceOrAdmin`) on every request — after fetching the
  resource, before returning or mutating it — which is the actual IDOR/BOLA
  choke point ARCHITECTURE.md §10.6 asks for; a 404 for "doesn't exist" and
  a 403 (via `requireOwnResourceOrAdmin`) for "exists but isn't yours" are
  deliberately indistinguishable in shape to a client probing ids.
- `requireOnboardedUserForPage()` (`lib/auth/page-guards.ts`): wraps
  `requireAuthenticatedUserForPage()` and redirects to `/onboarding` unless
  `onboardingCompletedAt` is set; admins are exempt (they never go through
  the wizard). Wired into the `dashboard`/`trends`/`profile` layouts;
  `admin` still uses the plain `requireAdminForPage()` from Phase 1.
- UI: a 3-step onboarding wizard (Personal → Exercise → Nutrition) at
  `/onboarding`, each step client-validated with the same Zod schemas the
  API enforces; real editable forms replacing the Phase 1 placeholders at
  `/profile` (personal info), `/profile/lifestyle` (exercise),
  `/profile/nutrition`; full add/edit/delete UI for `/profile/supplements`
  and `/profile/goals` (inline edit, no page navigation, optimistic local
  state updates from the API response).
- New UI primitives: `components/ui/select.tsx`, `components/ui/textarea.tsx`.
- `lib/utils.ts` gained `parseTagList`/`formatTagList` — the free-text,
  comma-separated tag inputs (custom activities, allergies, intolerances,
  avoided foods) are edited as one string client-side and converted to/from
  the real `string[]` schema field at the form boundary, so the API and
  database contract stays a proper array throughout.
- `middleware.ts`: added `/onboarding` to the protected-prefix list and the
  route matcher. It was missed in Phase 1 (the placeholder page existed but
  wasn't wired into the edge guard) — an unauthenticated request now
  307-redirects to `/login` at the edge, consistent with every other
  authenticated route, instead of reaching the Node-runtime page component
  at all.

## Tests

- **140 new tests added since the base Phase 1 suite, 257 total across 29
  files, all passing** (`npm run test:coverage`) — Phase 1's original 87
  tests were re-run unchanged alongside everything below, confirming
  nothing in Phase 2 regressed them:
  - Schemas: `onboarding.schemas.test.ts` (23), `supplement.schemas.test.ts`
    (11), `goal.schemas.test.ts` (10).
  - Services (Prisma mocked): `profile.service.test.ts` (9, including the
    `completeOnboarding` transaction), `supplements.service.test.ts` (6),
    `goals.service.test.ts` (6).
  - `utils.test.ts` gained cases for `parseTagList`/`formatTagList`;
    `page-guards.test.ts` gained cases for `requireOnboardedUserForPage`
    (admin exemption, onboarded/not-onboarded, missing user record,
    unauthenticated delegation).
  - **API route handlers — new this round, one file per route** (mocking
    `authorization`, the relevant service module, and the logger; calling
    the exported `GET`/`POST`/`PATCH`/`DELETE` functions directly with real
    `Request` objects): `api-onboarding.route.test.ts` (5),
    `api-profile.route.test.ts` (7), `api-profile-exercise.route.test.ts`
    (5), `api-profile-nutrition.route.test.ts` (5),
    `api-supplements.route.test.ts` (7), `api-supplements-id.route.test.ts`
    (16), `api-goals.route.test.ts` (7), `api-goals-id.route.test.ts` (16).
    The two `-id` suites are the IDOR/BOLA tests ARCHITECTURE.md §10.6
    calls for: unauthenticated → 401 (resource never read), nonexistent id
    → 404 (ownership never checked), wrong owner → 403 (mutation never
    runs), owner → 200/204, and — the case that actually proves
    `requireOwnResourceOrAdmin` does its job — an admin successfully
    reading/writing a resource owned by someone else.
  - While already touching Phase 1's own auth routes (extending the
    coverage `include` to `src/app/api/**` surfaced that they had never had
    route-level tests either, only their service layer did): added
    `api-auth-register.route.test.ts` (7, including the enumeration-safety
    case — registering an already-used email still returns the same 201),
    `api-auth-verify-email.route.test.ts` (3),
    `api-auth-request-password-reset.route.test.ts` (7, same
    enumeration-safety property — known vs. unknown email, and even a
    thrown service error, all produce the identical 200), and
    `api-auth-reset-password.route.test.ts` (5).
- 100% statement/branch/function coverage on every new module and every
  API route handler in both `src/app/api/**` and the Phase 1 auth routes,
  except one intentionally-unreachable defensive branch: `register/route.ts`
  line 11's `email.split('@')[1] ?? ''` fallback can't be hit because
  `RegisterSchema`'s `.email()` check already guarantees an `@` is present
  by the time that line runs. The two pre-existing 0%-coverage exceptions
  (`auth.ts`, `lib/db/prisma.ts`) are unchanged from Phase 1 and still
  documented there; `[...nextauth]/route.ts` (a 3-line re-export of
  Auth.js's own handlers) is now covered too via a trivial identity check.
- `npx tsc --noEmit`: clean except the same `@prisma/client` stub-typing
  gap documented in Phase 1 (`UserRole`, `UserStatus`, `DietType`,
  `ActivityLevel`, `GoalType`, `GoalStatus`), now also covering `Goal` and
  `Supplement` model types imported by the two new service files for
  return-type annotations. All resolve once `prisma generate` runs with
  real network access — nothing here is Phase-2-specific.
- `npx eslint .`: clean. Added `argsIgnorePattern`/`varsIgnorePattern: '^_'`
  to the `no-unused-vars` rule (a standard convention) so the new tests can
  destructure-and-drop a field (`const { active: _active, ...rest } = …`)
  without a lint error; nothing else in `.eslintrc.json` changed.
- `vitest.config.ts`'s coverage `include` gained `src/app/api/**` (it
  previously covered only `src/lib/**`/`src/modules/**`), so route handlers
  are now part of the tracked coverage report going forward, not just the
  service functions they call.
- **Ran the app again** (Postgres + `npm run dev` + Playwright hitting the
  live server): `/login`/`/register` unaffected (re-screenshotted, byte-
  identical rendering to Phase 1); unauthenticated `/onboarding` now
  307-redirects to `/login?callbackUrl=%2Fonboarding` (previously 500'd —
  see the middleware fix above); unauthenticated `/dashboard`, `/trends`,
  `/profile` still 307-redirect as in Phase 1.
- **Known sandbox-only gap, not a code defect**: unauthenticated requests to
  the new CRUD API routes (`/api/onboarding`, `/api/supplements`,
  `/api/goals`, …) 500 in *this* build sandbox instead of returning a clean
  401. Root cause: importing `lib/auth/authorization.ts` — which every one
  of these routes does, to call `requireAuthenticatedUser()` — transitively
  imports `lib/auth/auth.ts` and therefore `lib/db/prisma.ts`, and
  `new PrismaClient()` throws synchronously at *module load time* here
  because `prisma generate` never ran for real (the same blocked-
  `binaries.prisma.sh` limitation from Phase 1). There is no middleware
  equivalent for API routes to dodge this the way the page redirect does.
  On a machine where `npm run prisma:generate` has actually run, this
  import is inert and `requireAuthenticatedUser()` behaves normally — cleanly
  returning 401 via `toErrorResponse`, exactly as the 100%-covered
  `authorization.test.ts`/route logic already proves in isolation. No
  authenticated flow (submitting the wizard, creating a supplement, etc.)
  could be exercised live in this sandbox for the same underlying reason —
  identical to Phase 1's login/registration flows never being exercised
  live end-to-end either.

## Known limitations

- Same Prisma-engine sandbox limitation as Phase 1 (see there for the full
  explanation); nothing new introduced by Phase 2.
- The onboarding wizard's step-back navigation can show an empty birth-date
  field if you go back to step 1 after filling it in (a `Date` object isn't
  a valid `<input type="date">` default) — cosmetic only, the field is
  still editable and the schema still validates on re-submit; not worth a
  workaround given the wizard is meant to be filled forward once.
- No optimistic-UI rollback on a failed supplement/goal edit — the inline
  form just shows an error and stays open for retry, it doesn't restore an
  in-place previous value into the read view (there's nothing to roll back,
  since the read view only updates after a successful save).
- Decimal fields (`heightCm`, `weightKg`, `dosage`, `targetValue`) are
  converted with `Number()` at the Server Component boundary before being
  passed to Client Components, since a real Prisma `Decimal` instance isn't
  a value Next.js can serialize across that boundary. This is standard
  practice for Prisma + RSC and unrelated to the sandbox limitation.

## Next phase

**Correction (written from Phase 3):** the note originally here described
Phase 3 as the Oura OAuth flow itself. That's wrong — ARCHITECTURE.md §12's
phased delivery plan puts the OAuth authorization-code flow
(`/api/integrations/oura/connect|callback|disconnect`) in **Phase 4**. Phase
3 is narrower: the wearable domain layer, the provider-adapter interface,
and encrypted-credential storage — the plumbing Phase 4 will call, not the
OAuth flow itself. See `docs/phase-3-summary.md`.
