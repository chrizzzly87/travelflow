# Transport Mode Contract

This repo uses a single transport-mode contract for prompt guidance, parsing, normalization, and benchmark validation.

## Source Of Truth

1. `shared/transportModes.ts`
- Canonical enum values.
- UI ordering for selectors/panels.
- Alias mapping (normalization) from provider/model outputs to canonical values.
- Prompt guidance block for valid formatting examples.

2. `shared/durationParsing.ts`
- Shared parser for flexible duration inputs.
- Prompt guidance block for strict duration formatting.

## Core Rules

1. Canonical transport modes are lowercase:
- `plane`, `train`, `bus`, `boat`, `car`, `walk`, `bicycle`, `motorcycle`, `na`

2. Model output contract for `travelSegments.transportMode`:
- Must be lowercase canonical enum values.
- Benchmark validation distinguishes:
  - blocking errors for unknown/unmappable values,
  - non-blocking warnings for alias/casing values that are auto-normalized.

3. Unknown transport values are normalized to `na` during trip building.
- `na` is treated as "not set".
- Map transport marker icons are not drawn for `na`.

## Update Workflow (Required)

When adding or changing a transport mode, update all of these in the same PR:

1. `shared/transportModes.ts`
- Add enum value.
- Add alias mappings.
- Update UI order if needed.

2. `components/TransportModeIcon.tsx`
- Add icon mapping for the new canonical value.

3. `components/ItineraryMap.tsx`
- Add/adjust route-mode handling if the new mode needs routing behavior changes.

4. `services/aiService.ts`
- Ensure prompt/schema guidance includes the updated contract.

5. `netlify/edge-functions/ai-benchmark.ts`
- Keep validation checks aligned with the contract.

6. If new mode needs additional metadata (example: `camper` / `motorhome` with size + weight):
- Extend generation schema + prompt contract.
- Extend validation checks.
- Extend persistence fields as needed before enabling that mode.

## Integration Points

Current implementation consumes the shared contract in:

1. `services/aiService.ts`
2. `netlify/edge-functions/ai-benchmark.ts`
3. `components/DetailsPanel.tsx`
4. `components/Timeline.tsx`
5. `components/VerticalTimeline.tsx`
6. `components/ItineraryMap.tsx`
7. `components/TransportModeIcon.tsx`
8. `utils.ts`
