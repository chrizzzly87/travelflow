# UX Writing + Copy Guidelines

This guide defines how to write copy for TravelFlow marketing pages, CTAs, and planner UX.

## Voice And Tone
- Write modern, friendly, and dynamic.
- Be clear and human, not stiff or corporate.
- Keep momentum in wording: active verbs over abstract nouns.
- Prefer short, confident sentences.
- Avoid hype promises that cannot be proven.

## Marketing Copy Rules
- Lead with user outcome, then explain how.
- Keep headline language specific and vivid.
- Make subheads concrete: what users can do, save, or understand faster.
- Avoid empty phrases like "best-in-class," "synergy," or "revolutionary."
- Keep paragraphs scannable: 1 idea per sentence, 2–3 sentences per block.

## CTA Copy Rules
- Use action-first labels: verb + result.
- Keep CTAs short (usually 2–5 words).
- Prefer clarity over cleverness.
- Match CTA strength to context:
  - Primary action: direct and outcome-oriented.
  - Secondary action: low-pressure, exploratory.
- Good patterns:
  - `Start planning`
  - `See example trips`
  - `Build my route`
  - `Compare plans`

## Trip Planner Microcopy Rules
- Keep instructions short and explicit.
- In forms, describe required input and expected format.
- Error text must include recovery action.
- Empty states should guide next step.
- Loading states should confirm progress in plain language.
- Use consistent terminology for the same concept across screens.

## Localization And Transcreation Rules
- Do not translate copy word-for-word between languages.
- Preserve meaning and intent, adapt wording to natural usage in target language.
- Prefer equivalent concept over literal phrasing.
- Keep product and brand terms stable unless localized naming is explicitly approved.
- Avoid idioms that do not transfer well across languages.
- For interpolation in locale files, use ICU placeholders (`{name}`), not legacy moustache placeholders (`{{name}}`).
- Before adding keys, decide namespace placement (`common/pages/legal` vs route namespace) using `docs/I18N_PAGE_WORKFLOW.md`.
- For new user-facing keys, update all active locales (`en`, `es`, `de`, `fr`, `pt`, `ru`, `it`, `pl`, `ko`) in the same change.

## Mandatory Approval Step (EN/DE)
- For any new or rewritten user-facing copy, ask for style approval before finalizing.
- Ask in both languages the user confirmed they can review:
  - English
  - German
- Keep the request compact and concrete:
  - show final EN copy block
  - show final DE copy block
  - ask if tone should be more playful, more premium, or more direct
- If feedback is unclear, ask a focused follow-up question before shipping.
- Exemption: Admin workspace copy (`/admin/*`, admin tables/drawers/modals, admin-only controls) is English-only by default and does not require EN/DE sign-off unless explicitly requested.

## Agent Checklist For Copy Changes
1. Check this file before editing marketing/planner text.
2. Draft copy in EN first, then adapt to DE with transcreation (not literal translation).
3. Validate consistency with existing UI terminology.
4. Request EN/DE style sign-off from the user for localized marketing/planner copy.
5. Skip bilingual sign-off for admin-only copy unless explicitly requested.
6. Only finalize after feedback or explicit user opt-out where sign-off applies.
