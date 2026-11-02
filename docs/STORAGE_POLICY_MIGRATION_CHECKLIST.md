# Browser storage policy

The migration from raw browser storage to `services/browserStorageService.ts` is complete;
this file keeps the rules that still apply.

## Rules
- Use `readLocalStorageItem` / `writeLocalStorageItem` / `removeLocalStorageItem` for local storage.
- Use `readSessionStorageItem` / `writeSessionStorageItem` / `removeSessionStorageItem` for session storage.
- Do not introduce new direct `localStorage` / `sessionStorage` calls in runtime code. The
  low-level key-iteration paths in `services/browserStorageService.ts` and
  `services/authService.ts` are the intentional exceptions.
- Register every key in `lib/legal/cookies.config.ts` before using the helpers. Writes to an
  unregistered key are refused at runtime, and `pnpm storage:validate` does not catch every case.

## Verification
- Run `pnpm storage:validate`.
- Run targeted Vitest for touched modules and `pnpm test:core`.
