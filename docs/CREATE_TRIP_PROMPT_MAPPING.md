# Create-Trip Prompt Mapping (Default Classic Card)

## Goal
Keep the current `buildClassicItineraryPrompt` contract stable while the new `/create-trip` UI is rolled out.

## Current Prompt Contract
The default create-trip page calls:
- `generateItinerary(prompt, startDate, options)`
- prompt builder: `buildClassicItineraryPrompt(...)`
- options type: `GenerateOptions` in `services/aiService.ts`

## Field Mapping (UI -> Prompt)
| UI field | Prompt mapping | Notes |
|---|---|---|
| Destinations (ordered) | `prompt` string (`"Country A, Country B"`) | Uses destination labels from destination utilities. |
| Start date | `startDate` function arg | Used as itinerary anchor date. |
| End date (exact mode) | `options.totalDays` via date diff | Kept in classic contract as duration. |
| Flexible weeks (flex mode) | `options.totalDays = weeks * 7` | Duration-only mapping, no season-window prompt extension yet. |
| Budget | `options.budget` | Direct pass-through. |
| Pace | `options.pace` | Direct pass-through. |
| Round trip | `options.roundTrip` | Direct pass-through. |
| Special notes | `options.interests` | Comma-split into string array. |

## Visible But No-Effect Fields (v1)
The following fields are intentionally editable in UI but ignored by prompt generation in this rollout:
- Traveler setup
- Trip style
- Transport preferences
- Route lock semantics
- Flexible window season (`spring/summer/...`) semantics

Effective defaults shown in UI:
- Traveler setup: `solo`
- Trip style: `everything_except_remote_work`
- Transport preference: `automatic`

## Benchmark Alignment
`/admin/ai-benchmark` mirrors the new mask but still emits the same classic prompt contract.
It stores preview-only selections in scenario metadata under:
- `metadata.ignored_inputs`
- `metadata.effective_defaults`

This preserves result comparability across historical benchmark runs.

## Localization Namespace Decision
Use a dedicated `createTrip` namespace (instead of expanding `common`/`pages`):
- Keeps tool-flow copy isolated from marketing/global strings.
- Reduces namespace bloat and merge conflicts on shared files.
- Allows targeted preload for tool routes (`/create-trip*`) in header/mobile language switching.

## Proposed Future Prompt Extensions (not in this rollout)
1. Add traveler profile field to prompt contract (`travelerProfile`).
2. Add style signal field (`styleSignals[]`) with controlled vocabulary.
3. Add transport preference strategy (`transportPreference` + weights).
4. Add route lock behavior signal (`enforceDestinationOrder`).
5. Add flexible season window signal (`preferredSeasonWindow`) and month recommendations payload.

## Rollout Rule
Do not change existing prompt contract fields in this phase. Extend behind explicit versioning (`prompt_contract_version`) when benchmark migration is ready.
