# LLM.md

## Global model guidance
- Read `docs/UPDATE_FORMAT.md` at the start of work.
- Read `docs/BRAND_CI_GUIDELINES.md` before implementing or restyling UI.
- Read `docs/PAYWALL_GUIDELINES.md` before changing trip expiration, lock, or access behavior.
- Read `docs/I18N_PAGE_WORKFLOW.md` before adding/updating localized pages, route strategy, or translation resources.
- Read `docs/UX_COPY_GUIDELINES.md` before editing marketing/planner copy or CTA text.
- Read `docs/ANALYTICS_CONVENTION.md` before adding/updating analytics events.
- Use ICU placeholder syntax in locale strings (`{name}`), never legacy `{{name}}` placeholders.
- For new locale keys, update all active locales (`en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`) and explicitly decide namespace placement (`common/pages/legal` vs route/feature namespace).
- Keep code changes aligned with existing architecture and route stability.
- Any completed feature/fix must be reflected in `content/updates/*.md`.
- For new components, check whether logical CSS properties should be used for direction safety; if unclear, ask for clarification.
- For user-facing copy edits, ask the user for EN/DE style sign-off unless they explicitly opt out.
- Release notes in `content/updates/*.md` are always written in English and do not require EN/DE translation prompts or style sign-off unless explicitly requested.
- For clickable marketing/planner UI updates, add `trackEvent(...)` + `getAnalyticsDebugAttributes(...)` in the standard format unless explicitly excluded.
- For locale changes, run `npm run i18n:validate` to enforce locale namespace parity and ICU placeholder syntax.

## Update entry policy
- Use one release note file per worktree/feature, not multiple incremental files.
- Finalize/update that single release note shortly before opening the PR.
- User-facing items: `- [x] [Type] ...`
- Internal-only items: `- [ ] [Internal] ...`
- Prefix each change message with the emoji style defined in `docs/UPDATE_FORMAT.md`.
- Most important changes first, fixes later.
- Bump and maintain strictly increasing release versions for published entries.
