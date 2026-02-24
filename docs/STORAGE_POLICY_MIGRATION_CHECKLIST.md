# Storage Policy Migration Checklist

This checklist tracks Phase 2 migration from raw browser storage access to `services/browserStorageService.ts`.

## Migration Rule
- Use `readLocalStorageItem` / `writeLocalStorageItem` / `removeLocalStorageItem` for local storage.
- Use `readSessionStorageItem` / `writeSessionStorageItem` / `removeSessionStorageItem` for session storage.
- Do not introduce new direct `localStorage` / `sessionStorage` calls in runtime code.
- Register every key in `lib/legal/cookies.config.ts` before using helper APIs.

## Completed In Phase 2 (Current Batch)
- [x] `services/authNavigationService.ts`
- [x] `services/authUiPreferencesService.ts`
- [x] `services/authTraceService.ts`
- [x] `services/simulatedLoginService.ts`
- [x] `config/paywall.ts` (debug expiry overrides)
- [x] `app/bootstrap/useDebuggerBootstrap.ts`
- [x] `services/lazyImportRecovery.ts`
- [x] `components/navigation/LanguageSuggestionBanner.tsx`
- [x] `components/marketing/TranslationNoticeBanner.tsx`
- [x] `components/ReleaseNoticeDialog.tsx`
- [x] `pages/UpdatesPage.tsx` (simulated-login debug read)

## Remaining Direct Storage Usage (Next Batches)
- [ ] `services/authService.ts` (Supabase wildcard/session cleanup path)
- [ ] `services/consentState.ts` (consent bootstrap read path)
- [ ] `services/dbService.ts` (planner view preference writes)
- [ ] `services/storageService.ts` and `services/historyService.ts`
- [ ] `components/tripview/*` persistence hooks
- [ ] `components/TripManager.tsx` / `components/ItineraryMap.tsx` / `components/CountryInfo.tsx`
- [ ] `components/admin/*` cache utilities and shell state
- [ ] `components/OnPageDebugger.tsx`
- [ ] `components/marketing/EarlyAccessBanner.tsx`

## Verification
- Run `pnpm storage:validate`.
- Run targeted Vitest for touched modules and `pnpm test:core`.
