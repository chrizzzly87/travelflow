# Create-Trip Prompt Mapping

## Goal
Keep classic and wizard on one effective planning contract so the model receives the same real preference signals regardless of entry flow.

## Runtime Contract
- Classic prompt builder: `buildClassicItineraryPrompt(...)`
- Wizard prompt builder: `buildWizardItineraryPrompt(...)`
- Shared preference shape: `shared/createTripPreferences.ts`
- Shared system framing: `netlify/edge-lib/ai-provider-runtime.ts`

Both flows now send:
- destination order and optional fixed-route semantics
- traveler setup and optional traveler details
- trip style and activity-focus signals
- transport preferences and override state
- exact dates or flexible date-window semantics
- budget, pace, specific cities, and free-form notes

## Field Mapping
| UI field | Prompt mapping | Notes |
|---|---|---|
| Destinations | `destinationPrompt` / `options.countries` | Uses normalized destination prompt labels. |
| Start destination | `startDestination` | Biases the first stop even when the route is not locked. |
| Fixed route / destination order | `destinationOrder`, `routeLock` | Locked order becomes a hard instruction. |
| Exact dates | `startDate`, `endDate`, `totalDays` | `startDate` remains the itinerary anchor date. |
| Flexible dates | `dateInputMode='flex'`, `flexWeeks`, `flexWindow`, `totalDays` | Also adds season-window language plus ideal/shoulder months when available. |
| Traveler setup | `travelerType` | Used as a real planning constraint. |
| Traveler detail fields | `travelerDetails` | Family, couple, solo, and friends subfields influence pacing/safety guidance. |
| Trip style | `tripStyleTags` | Shapes route choice and city/activity selection. |
| Activity focus / vibes | `tripVibeTags` | Helps activity mix feel intentional instead of generic. |
| Transport preferences | `transportPreferences`, `hasTransportOverride` | Influences routing and transfer recommendations. |
| Budget | `budget` | Direct pass-through in classic and wizard. |
| Pace | `pace` | Direct pass-through in classic and wizard. |
| Specific cities | `specificCities` | Added as a direct constraint. |
| Notes | `notes` and `interests` | Notes remain intact; comma-separated note fragments also feed the generic interest hint. |
| Island-only planning | `selectedIslandNames`, `enforceIslandOnly` | Prevents silent mainland drift for island-driven routes. |

## Output Guardrails
- Both flows append the strict JSON object contract.
- The provider/runtime system prompt now frames the model as a TravelFlow itinerary specialist and enforces JSON-only output.
- Suitability mismatches use warn-and-adapt behavior:
  - keep requested destinations when possible
  - adapt routing and recommendations
  - allow an optional `### Heads Up` section inside `city.description` when needed

## Prefill Contract
- Shared draft payload: `TripPrefillData.meta.draft`
- New shared draft version: `version: 2`
- The classic route reads both the legacy flat draft fields and the shared nested fields.
- The wizard persists the shared draft shape so classic/wizard handoff stays compatible.

## Benchmark Alignment
`/admin/ai-benchmark` still stores benchmark-only masks for controlled comparisons, but the metadata naming now reflects real preference signaling:
- `input.preferenceSignals`
- `metadata.preference_signals`
- `metadata.baseline_defaults`

This keeps benchmark scenarios explainable without calling live planner fields “preview only”.
