# Trip Agent: collaborative AI chat and approved trip changes

This is the repository mirror of the GitHub epic checklist. The GitHub epic is authoritative; update both when a delivery slice changes state.

## Testable PoC

- [x] Add versioned context references and allowlisted trip-change operations.
- [x] Add persistent shared chats, messages, runs, tools, proposals, usage counters, prompt versions, and agent definitions.
- [x] Apply the live Supabase migrations with RLS and service-only mutation policies.
- [x] Enforce three free requests per UTC day before model access.
- [x] Add the floating desktop panel and mobile sheet with selection context, examples, history, authors, and proposal review.
- [x] Apply selected changes atomically as one remote version and adopt that version once in local undo/redo history.
- [x] Keep the global rollout disabled while allowing administrator preview.
- [x] Deploy and smoke-test the named Netlify feature preview.

Preview: [trip-agent-collaborative-ai--travelflowapp.netlify.app](https://trip-agent-collaborative-ai--travelflowapp.netlify.app)

## Delivery tracks

- [x] #486 Persistence, entitlements, quota, and agent configuration — PoC foundation implemented.
- [x] #481 Streaming orchestrator and atomic change-set application — PoC foundation implemented.
- [x] #484 Planner chat UI and timeline context — PoC foundation implemented.
- [ ] #485 Hotel and route specialists — grounded adapter exists; normalized visual result cards and production credentials remain.
- [ ] #482 Admin transcripts, prompt management, telemetry, and rollout — schema/records exist; admin workspace and rollout dashboards remain.
- [ ] #483 JourneySpec interoperability — blocked on PR #444.

## Production gates

- [ ] Configure `AI_GATEWAY_API_KEY` on Netlify and validate approved model discovery/routing.
- [ ] Configure a server-restricted `GOOGLE_MAPS_GROUNDING_API_KEY` and run grounded specialist smoke tests.
- [ ] Add deterministic fake Gateway/MCP browser E2E coverage.
- [ ] Verify authenticated transcript reload, cancellation, quota refund, and stale-proposal paths in the deployed environment (unauthenticated endpoint guard is verified).
- [ ] Build the English-only admin transcript and prompt-management workspace.
- [ ] Enable for all eligible accounts only after persistence, quota, atomic apply, telemetry, and rollback gates pass.
