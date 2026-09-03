# Trip Agent: collaborative AI chat and approved trip changes

This is the repository mirror of the GitHub epic checklist. The GitHub epic is authoritative; update both when a delivery slice changes state.

How the chat runs, which functions the agents may call, and which trip changes they can propose: [ARCHITECTURE.md](./ARCHITECTURE.md).

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

## PoC stabilization

- [x] Accept empty successful Supabase write responses and refund quota when pre-stream persistence fails.
- [x] Render request failures inside the conversation with a named error code and a one-click retry of the same message.
- [x] Stream assistant reasoning into the conversation as a collapsible step list.
- [x] Match the planning animation typography to normal assistant text.
- [x] Add a shadcn command menu for `/` presets and `@` trip, city, activity, stay, and travel context.
- [x] Log bounded request/run identifiers and failure summaries without prompts, credentials, or raw provider payloads.
- [x] Raise the Netlify build to Node 22 with `--max-old-space-size=4096`; `vite build` was aborting at the default ~2 GB heap (exit 134, reported by Netlify as exit code 2), which broke every deploy preview on this branch.
- [x] Describe attached `@` context inside the run instructions instead of relying on the trip-context tool call.
- [x] Group consecutive thinking and tool events into one collapsed activity block with tool chips.
- [x] Accept loosely shaped proposal payloads and answer schema failures with fixable issues instead of an opaque tool error.
- [x] Review proposals in a pick-then-preview flow that never writes before the preview is confirmed.
- [x] Group the `@` menu by trip, cities, stays, activities and transfers.
- [x] Name chats after their first prompt and group the history menu by recency with per-section caps.
- [x] Show relative message timestamps and drop the redundant author label on your own messages.
- [x] Forward refs from the shared button so preact/compat popovers keep a real anchor element.
- [x] Drop the math, mermaid and syntax-highlighting markdown plugins from the chat renderer.
- [x] Emit trip changes through a flat wire schema so function-calling models can produce them, and convert to the typed union server-side.
- [x] Run the planner on the app-wide default model (`ai_default_model_id`) with a controllable reasoning effort and a 12k output budget.
- [x] Show the running step, elapsed time and a slow-request note while a run is in flight.
- [x] Explain every tool chip, and list the agent's capabilities and possible trip changes in the panel.
- [x] Move attached context chips into the message box with kind icons.
- [x] Verify one real trip end to end with `pnpm trip-agent:dry-run` (Taiwan reorder: 32 operations, 21 items, no no-ops).
- [ ] Verify the deploy preview end to end with an administrator account (transcript reload, retry, apply, quota refund).
- [x] Resolve the specialist model the same way as the orchestrator; a bare model id only worked with the AI Gateway.
- [ ] Normalize specialist result cards for stays and routes (#485).

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
