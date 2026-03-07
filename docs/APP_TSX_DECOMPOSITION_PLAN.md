# App.tsx Decomposition Plan

Status: draft  
Date: 2026-03-06

## 1. Current problem
`App.tsx` currently owns too many responsibilities:
- locale + title orchestration
- auth/terms gating + redirect behavior
- trip lifecycle mutation handlers
- DB/user settings persistence glue
- global completion watch/toast wiring
- route wiring and provider shell coordination

This makes regressions harder to isolate and increases callback identity churn risks.

## 2. Target decomposition

### A. `app/controllers/useAppLocaleController.ts`
Owns:
- route-locale resolution
- i18n language sync
- document locale application
- page title updates

Inputs:
- `location`, `tripTitle`, `i18n`, `t`

Outputs:
- `appLanguage`, `setAppLanguage`, `resolvedRouteLocale`

### B. `app/controllers/useTermsGateController.ts`
Owns:
- terms notice/gate state computation
- notice dismissal/version handling
- open-terms navigation action

Inputs:
- auth/access/route state

Outputs:
- `shouldBlockForTermsGate`, `shouldRenderTermsNotice`, handlers

### C. `app/controllers/useTripPersistenceController.ts`
Owns:
- `handleUpdateTrip`
- `handleCommitState`
- resilient owned/admin commit paths
- local history entry creation glue

Inputs:
- connectivity snapshot, DB helpers, `navigate`

Outputs:
- stable persistence callbacks for routes/components

### D. `app/controllers/useUserSettingsPersistence.ts`
Owns:
- language persistence
- view settings persistence dedupe/debounce
- cleanup timer lifecycle

Inputs:
- auth/access, DB enabled

Outputs:
- `handleViewSettingsChange`, `setAppLanguage`

### E. `app/controllers/useTripGenerationCompletionToasts.ts`
Owns:
- generation completion watch subscriptions
- toast rendering with deep-link actions

Inputs:
- navigate/show toast helpers

Outputs:
- side-effect only hook

## 3. Refactor phases
1. **Phase 1 (safe extraction)**
- Extract D and E first (minimal route coupling).
- Keep existing App props/behavior unchanged.

2. **Phase 2 (routing + persistence split)**
- Extract C with strict unit coverage around commit behavior.
- Replace inline handlers in `App.tsx` with returned controller callbacks.

3. **Phase 3 (locale/terms split)**
- Extract A and B.
- Add focused tests for route-locale + terms-gate decision matrix.

4. **Phase 4 (shell simplification)**
- Convert `App.tsx` into a thin composition root that wires providers, controllers, and `AppRoutes`.

## 4. Acceptance criteria
- `App.tsx` line count reduced by at least 40%.
- No behavior changes in:
  - trip create/load/update/commit
  - terms gating
  - locale/title behavior
  - generation completion toasts
- Callback identity stability preserved or improved for route + trip view wiring.
- `pnpm test:core` green after each phase.

## 5. Risk controls
- Keep each phase in a separate PR/commit package.
- Add regression tests before moving logic out of `App.tsx`.
- Do not mix feature behavior changes into extraction commits.
