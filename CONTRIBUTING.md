# Contributing to Travelflow

Thanks for helping us build a better trip planner! This document highlights the compliance-sensitive areas that require extra care during development.

## Cookie Compliance

We maintain a single source of truth for every cookie or persistent storage key at `lib/legal/cookies.config.ts`. Follow the checklist below whenever you add, rename, or remove cookies:

1. **Register the cookie** – Add an entry in `lib/legal/cookies.config.ts` with `name`, `purpose`, `duration`, `provider`, and (optionally) `storage` + `notes`.
2. **Pick the correct category** – `essential`, `analytics`, or `marketing`. Essential cookies must be required for security/auth. Analytics/marketing entries must remain disabled until the user opts in via the consent banner.
3. **Update consent flows** – If you introduce a non-essential cookie, wire it into the consent gate in `services/consentService.ts` / `components/marketing/CookieConsentBanner.tsx` so it only loads after acceptance.
4. **Regenerate the policy** – Run `npm run sitemap:generate` (already part of CI) if you changed route structure and review `/cookies` to ensure the policy reflects the latest registry.
5. **Document processors** – Mention any new vendors (e.g., analytics suites, marketing pixels) in the privacy policy copy when applicable.

✅  Keeping the registry accurate guarantees our Cookie Policy, consent banner, and privacy disclosures stay in sync.

## Environment-driven legal data

All legal contact information lives in environment variables prefixed with `NEXT_PUBLIC_LEGAL_`. Never hardcode personal data in the repository. See `.env.example` for the exhaustive list and always provide safe fallbacks when rendering the data in UI.
